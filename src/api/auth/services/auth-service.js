"use strict";

module.exports = ({ strapi }) => {
  // Dependency injection (DIP)
  const getSecurity = () => strapi.service('api::auth.security-logic');

  return {
    // تسجيل الدخول مع HttpOnly cookies
    async login(ctx, identifier, password) {
      try {
        const user = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: {
            $or: [
              { email: identifier.toLowerCase() },
              { username: identifier }
            ]
          },
          populate: { role: true }
        });

        if (!user || user.blocked || !user.confirmed) {
          throw new Error(!user ? "Invalid credentials" : (user.blocked ? "User is blocked" : "User is not confirmed"));
        }

        const validPassword = await strapi.plugins["users-permissions"].services.user.validatePassword(password, user.password);
        if (!validPassword) throw new Error("Invalid credentials");

        // Use Centralized Security (SRP/DRY)
        const jwt = getSecurity().issueToken(user);
        getSecurity().setAuthCookie(ctx, jwt);

        ctx.state.user = user;

        return {
          jwt,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            confirmed: user.confirmed,
            blocked: user.blocked,
          },
        };
      } catch (error) {
        throw error;
      }
    },

    // تسجيل الخروج
    async logout(ctx) {
      getSecurity().clearAuthCookie(ctx);
      return { message: "Logged out successfully" };
    },

    // الحصول على المستخدم الحالي
    async getCurrentUser(ctx) {
      const token = ctx.cookies.get("jwt");
      if (!token) return null;

      try {
        const payload = getSecurity().verifyToken(token);
        if (!payload) return null;

        const user = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { id: payload.id },
          populate: {
            role: true,
            avatar: true,
            scanners: { populate: { event: true } }
          }
        });

        if (user && !user.blocked) {
          return {
            id: user.id,
            username: user.username,
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname,
            phone: user.phone,
            university: user.university,
            avatar: user.avatar,
            role: user.role,
            confirmed: user.confirmed,
            blocked: user.blocked,
            scanners: user.scanners || []
          };
        }
      } catch (error) {
        return null;
      }
      return null;
    },

    // تحديث الـ token
    async refreshToken(ctx) {
      const token = ctx.cookies.get("jwt");
      if (!token) throw new Error("No token found");

      try {
        const payload = getSecurity().verifyToken(token);
        const user = await strapi.plugins["users-permissions"].services.user.fetch({ id: payload.id });

        if (!user || user.blocked) throw new Error("Invalid user");

        const newJwt = getSecurity().issueToken(user);
        getSecurity().setAuthCookie(ctx, newJwt);

        return {
          jwt: newJwt,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
          },
        };
      } catch (error) {
        throw error;
      }
    },

    // التحقق من الصلاحيات
    async checkPermission(ctx, action, subject) {
      const user = ctx.state.user;
      if (!user) return false;

      try {
        const ability = await strapi.plugins["users-permissions"].services.user.ability(user);
        return ability.can(action, subject);
      } catch (error) {
        return false;
      }
    },

    // التحقق من الدور
    async hasRole(ctx, roleName) {
      const user = ctx.state.user;
      if (!user || !user.role) return false;
      return user.role.type === roleName;
    },

    // تسجيل مستخدم جديد مع التحقق
    async register(ctx, userData) {
      const { username, email, password, firstname, lastname, phone, birthday, university } = userData;

      const existingUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] }
      });

      if (existingUser) {
        throw new Error(existingUser.email === email.toLowerCase() ? "Email already exists" : "Username already exists");
      }

      const defaultRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'authenticated' }
      });

      if (!defaultRole) throw new Error("Registration configuration error");

      // Generate 6-digit OTP code
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      const { password: hashedPassword } = await strapi.plugin('users-permissions').service('user').ensureHashedPasswords({ password });

      const newUser = await strapi.db.query('plugin::users-permissions.user').create({
        data: {
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          password: hashedPassword,
          role: defaultRole.id,
          confirmed: false,
          blocked: false,
          confirmationToken: otpCode, // Store OTP here
          firstname, lastname, phone, birthday, university
        }
      });

      // Send OTP via Email (non-blocking for UI speed)
      this.sendOtpEmail(newUser.email, otpCode);

      // Note: No JWT issued yet because confirmed is false
      return { user: { id: newUser.id, email: newUser.email, confirmed: false }, message: "OTP sent to email" };
    },

    // إعادة إرسال الكود
    async resendOtp(email) {
      if (!email) throw new Error("Email is required");
      
      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email: email.toLowerCase() }
      });

      if (!user) throw new Error("User not found");
      if (user.confirmed) throw new Error("User already confirmed");

      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: { confirmationToken: newOtp }
      });

      this.sendOtpEmail(user.email, newOtp);
      return { message: "New OTP sent to email" };
    },

    // التحقق من الكود
    async verifyOtp(ctx, email, code) {
      if (!email || !code) throw new Error("Email and code are required");

      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email: email.toLowerCase() },
        populate: { role: true }
      });

      if (!user) throw new Error("User not found");
      if (user.confirmed) throw new Error("User already confirmed");

      if (user.confirmationToken !== code) {
        throw new Error("Invalid activation code");
      }

      const updatedUser = await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: { confirmed: true, confirmationToken: null }
      });

      // Issue JWT after success
      const jwt = getSecurity().issueToken(updatedUser);
      getSecurity().setAuthCookie(ctx, jwt);

      return { 
        jwt, 
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          role: user.role,
          confirmed: true
        }
      };
    },
    // Helper to send OTP email
    async sendOtpEmail(email, code) {
      try {
        const fromEmail = process.env.GMAIL_USER || 'no-reply@axecode.com';
        await strapi.plugins['email'].services.email.send({
          to: email,
          from: fromEmail,
          subject: 'AxeCode | Identity Initialization Code',
          text: `Your identity initialization code is: ${code}`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #0b0f19; color: #ffffff; border-radius: 12px; border: 1px solid #1e293b;">
                <h2 style="color: #34d399; margin-bottom: 20px;">Identity Verification Protocol</h2>
                <p style="font-size: 14px; opacity: 0.8;">We've initialized your identity profile. Use the following code to authorize access:</p>
                <div style="background: #1e293b; padding: 15px; border-radius: 8px; text-align: center; margin: 25px 0;">
                    <span style="font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #34d399;">${code}</span>
                </div>
                <p style="font-size: 10px; opacity: 0.5;">If you didn't initiate this request, please ignore this transmission.</p>
            </div>
          `,
        });
        strapi.log.info(`[AuthService] OTP email dispatched to ${email}`);
      } catch (err) {
        strapi.log.error(`[AuthService] Failed to send OTP email: ${err.message}`);
      }
    },

    async forgotPassword(email) {
      if (!email) throw new Error("Email is required");
      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email: email.toLowerCase() }
      });

      if (!user || user.blocked) return { message: "If an account exists, a link has been sent." };

      const resetToken = getSecurity().issueToken(user); // Standard JWT for reset
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: { resetPasswordToken: resetToken }
      });

      return { message: "If an account exists, a link has been sent.", resetToken };
    },

    async resetPassword(code, password) {
      const payload = getSecurity().verifyToken(code);
      if (!payload) throw new Error("Invalid or expired reset code");

      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: payload.id }
      });

      if (!user || user.blocked) throw new Error("Invalid user");

      const { password: hashedPassword } = await strapi.plugin('users-permissions').service('user').ensureHashedPasswords({ password });
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: { password: hashedPassword, resetPasswordToken: null }
      });

      return { message: "Password updated successfully" };
    },
  };
};
