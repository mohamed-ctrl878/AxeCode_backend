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

      const hashedPassword = await strapi.plugin('users-permissions').service('user').hashPassword(password);

      const newUser = await strapi.db.query('plugin::users-permissions.user').create({
        data: {
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          password: hashedPassword,
          role: defaultRole.id,
          confirmed: false,
          blocked: false,
          firstname, lastname, phone, birthday, university
        }
      });

      const jwt = getSecurity().issueToken(newUser);
      getSecurity().setAuthCookie(ctx, jwt);

      return { jwt, user: newUser };
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

      const hashedPassword = await strapi.plugin('users-permissions').service('user').hashPassword(password);
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: { password: hashedPassword, resetPasswordToken: null }
      });

      return { message: "Password updated successfully" };
    },
  };
};
