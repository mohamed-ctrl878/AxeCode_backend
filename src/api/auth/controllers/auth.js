"use strict";

module.exports = {
  // Login with JWT sent as Cookie
  async login(ctx) {
    try {
      const { identifier, password, recaptchaToken } = ctx.request.body;

      if (!identifier || !password) {
        return ctx.badRequest("Missing identifier or password");
      }

      // Verify reCAPTCHA token if provided
      if (recaptchaToken) {
        const recaptchaService = strapi.service("api::auth.recaptcha-service");
        const clientIP = recaptchaService.getClientIP(ctx);
        
        const verificationResult = await recaptchaService.verifyRecaptcha(
          recaptchaToken,
          clientIP
        );
        
        if (!recaptchaService.isValidVerification(verificationResult)) {
          strapi.log.warn('Login rejected: reCAPTCHA verification failed', {
            identifier,
            clientIP,
            errorCodes: verificationResult.errorCodes,
          });
          return ctx.badRequest("reCAPTCHA verification failed", {
            error: "recaptcha_failed",
            details: "Please complete the reCAPTCHA verification"
          });
        }
        
        strapi.log.info('reCAPTCHA verification successful', {
          identifier,
          score: verificationResult.score
        });
      } else {
        // If reCAPTCHA is enabled but no token provided
        if (process.env.RECAPTCHA_REQUIRED === 'true') {
          return ctx.badRequest("reCAPTCHA verification is required", {
            error: "recaptcha_missing",
            details: "Please complete the reCAPTCHA verification"
          });
        }
      }

      // Find user
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { email: identifier },
        });

      if (!user) {
        return ctx.unauthorized("User not found");
      }

      // Validate password
      const validPassword = await strapi.plugins[
        "users-permissions"
      ].services.user.validatePassword(password, user.password);
      if (!validPassword) {
        return ctx.unauthorized("Invalid password");
      }

      if (user.blocked) {
        return ctx.forbidden("User is blocked");
      }

      if (!user.confirmed) {
        return ctx.forbidden("User is not confirmed");
      }

      // Create JWT
      const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
        id: user.id,
      });

      // Send JWT as Cookie
      ctx.cookies.set("jwt", jwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: "/",
      });

      // Return user data and JWT in body as well
      return ctx.send({
        jwt,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          confirmed: user.confirmed,
          blocked: user.blocked,
        },
      });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  // Logout
  async logout(ctx) {
    try {
      const authService = strapi.service("api::auth.auth-service");
      const result = await authService.logout(ctx);

      return ctx.send(result);
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  // Get current user
  async me(ctx) {
    try {
      const authService = strapi.service("api::auth.auth-service");
      const user = await authService.getCurrentUser(ctx);

      if (!user) {
        return ctx.unauthorized("Not authenticated");
      }

      return ctx.send({
        user: user,
      });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  // Refresh token
  async refresh(ctx) {
    try {
      const authService = strapi.service("api::auth.auth-service");
      const result = await authService.refreshToken(ctx);

      return ctx.send({
        message: "Token refreshed successfully",
        user: result.user,
      });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  // Check permissions
  async checkPermission(ctx) {
    try {
      const { action, subject } = ctx.request.body;

      if (!action || !subject) {
        return ctx.badRequest("Missing action or subject");
      }

      const authService = strapi.service("api::auth.auth-service");
      const hasPermission = await authService.checkPermission(
        ctx,
        action,
        subject
      );

      return ctx.send({
        hasPermission: hasPermission,
      });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  // Check role
  async checkRole(ctx) {
    try {
      const { roleName } = ctx.request.body;

      if (!roleName) {
        return ctx.badRequest("Missing role name");
      }

      const authService = strapi.service("api::auth.auth-service");
      const hasRole = await authService.hasRole(ctx, roleName);

      return ctx.send({
        hasRole: hasRole,
      });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  // Custom forgot password with email
  async forgotPassword(ctx) {
    try {
      const { email } = ctx.request.body;

      if (!email) {
        return ctx.badRequest("Email is required");
      }

      // Find user by email using Strapi v5 DB API
      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email }
      });

      if (!user) {
        // Return success even if user doesn't exist for security reasons
        return ctx.send({
          message: "If an account with that email exists, a password reset link has been sent.",
        });
      }

      if (user.blocked) {
        return ctx.badRequest("User account is blocked");
      }

      // Generate reset token
      const resetToken = strapi.plugins["users-permissions"].services.jwt.issue(
        {
          id: user.id,
        },
        {
          expiresIn: "1h", // Token expires in 1 hour
        }
      );

      // Update user with reset token using Strapi v5 DB API
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: {
          resetPasswordToken: resetToken,
        },
      });

      // Create frontend reset link
      const resetLink = `http://localhost:5173/reset-password?code=${resetToken}`;

      // HTML email template with styled button
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset Request</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello ${user.username || user.email},</p>
            
            <p style="font-size: 16px; margin-bottom: 25px;">We received a request to reset your password. Click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="
                display: inline-block;
                padding: 15px 30px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                font-size: 16px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                transition: transform 0.2s;
              ">Reset My Password</a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 25px;">Or copy and paste this link in your browser:</p>
            <p style="font-size: 12px; background: #e9ecef; padding: 10px; border-radius: 4px; word-break: break-all;">${resetLink}</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
              <p style="font-size: 14px; color: #666; margin: 0;">⚠️ This link will expire in 1 hour for security reasons.</p>
              <p style="font-size: 14px; color: #666; margin: 10px 0 0 0;">If you didn't request this password reset, you can safely ignore this email.</p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; padding: 20px; font-size: 12px; color: #999;">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </body>
        </html>
      `;

      // Send email
      await strapi.plugins["email"].services.email.send({
        to: email,
        subject: "Password Reset Request",
        html: emailHtml,
      });

      strapi.log.info(`Password reset email sent to: ${email}`);

      return ctx.send({
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (error) {
      strapi.log.error("Forgot password error:", error);
      return ctx.badRequest("An error occurred while processing your request");
    }
  },

  // Reset password using the token from email
  async resetPassword(ctx) {
    strapi.log.info('=== RESET PASSWORD FUNCTION CALLED ===');
    
    try {
      const { code, password, passwordConfirmation } = ctx.request.body;
      
      // Validate input
      if (!code || !password || !passwordConfirmation) {
        return ctx.badRequest({ error: "All fields are required" });
      }
      
      if (password !== passwordConfirmation) {
        return ctx.badRequest({ error: "Passwords do not match" });
      }
      
      if (password.length < 8) {
        return ctx.badRequest({ error: "Password must be at least 8 characters" });
      }
      
      // Verify JWT token
      const jwt = require('jsonwebtoken');
      let decoded;
      
      // Try with the JWT secret from your .env file
      const jwtSecret = 'SGmtLD+yGYH1SF2OPNTXBg==';
      
      try {
        decoded = jwt.verify(code, jwtSecret);
        strapi.log.info('JWT verified successfully:', { userId: decoded.id });
      } catch (jwtError) {
        strapi.log.error('JWT verification failed:', jwtError.message);
        return ctx.badRequest({ error: "Invalid or expired reset code" });
      }
      
      if (!decoded || !decoded.id) {
        return ctx.badRequest({ error: "Invalid token payload" });
      }
      
      const userId = decoded.id;
      strapi.log.info('Looking for user:', userId);
      
      // Find user
      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: userId }
      });
      
      if (!user) {
        return ctx.badRequest({ error: "User not found" });
      }
      
      if (user.blocked) {
        return ctx.badRequest({ error: "User account is blocked" });
      }
      
      strapi.log.info('User found:', { id: user.id, email: user.email });
      
      // Hash new password
      let hashedPassword;
      try {
        const hashResult = await strapi.plugins["users-permissions"].services.user.hashPassword({ password });
        hashedPassword = hashResult.password;
      } catch (hashError) {
        const bcrypt = require('bcrypt');
        hashedPassword = await bcrypt.hash(password, 10);
      }
      
      // Update password
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          resetPasswordToken: null
        }
      });
      
      strapi.log.info('Password reset successful for user:', user.email);
      
      return ctx.send({ message: "Password updated successfully" });
      
    } catch (error) {
      strapi.log.error('Reset password error:', error);
      return ctx.badRequest({ error: "Password reset failed" });
    }
  },

  // Custom registration with reCAPTCHA validation
  async register(ctx) {
    strapi.log.info('=== CUSTOM REGISTRATION FUNCTION CALLED ===');
    
    try {
      const { username, email, password, recaptchaToken, firstname, lastname, phone, birthday } = ctx.request.body;
      
      // Basic validation
      if (!username || !email || !password) {
        return ctx.badRequest("Username, email, and password are required");
      }
      
      // Verify reCAPTCHA token if provided
      if (recaptchaToken) {
        const recaptchaService = strapi.service("api::auth.recaptcha-service");
        const clientIP = recaptchaService.getClientIP(ctx);
        
        strapi.log.info('reCAPTCHA token provided for registration', {
          email,
          clientIP,
          tokenLength: recaptchaToken.length
        });
        
        const verificationResult = await recaptchaService.verifyRecaptcha(
          recaptchaToken,
          clientIP
        );
        
        if (!recaptchaService.isValidVerification(verificationResult)) {
          strapi.log.warn('Registration rejected: reCAPTCHA verification failed', {
            email,
            clientIP,
            errorCodes: verificationResult.errorCodes,
            score: verificationResult.score
          });
          return ctx.badRequest("reCAPTCHA verification failed", {
            error: "recaptcha_failed",
            details: "Please complete the reCAPTCHA verification"
          });
        }
        
        strapi.log.info('reCAPTCHA verification successful for registration', {
          email,
          score: verificationResult.score
        });
      } else {
        // If reCAPTCHA is enabled but no token provided
        if (process.env.RECAPTCHA_REQUIRED === 'true') {
          strapi.log.warn('Registration rejected: reCAPTCHA token missing', { email });
          return ctx.badRequest("reCAPTCHA verification is required", {
            error: "recaptcha_missing",
            details: "Please complete the reCAPTCHA verification"
          });
        }
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return ctx.badRequest("Invalid email format");
      }
      
      // Validate password strength
      if (password.length < 8) {
        return ctx.badRequest("Password must be at least 8 characters long");
      }
      
      // Check if user already exists
      const existingUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: {
          $or: [
            { email: email.toLowerCase() },
            { username: username.toLowerCase() }
          ]
        }
      });
      
      if (existingUser) {
        if (existingUser.email === email.toLowerCase()) {
          return ctx.badRequest("Email already exists");
        }
        if (existingUser.username === username.toLowerCase()) {
          return ctx.badRequest("Username already exists");
        }
      }
      
      // Get default role (usually "Authenticated")
      const defaultRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'authenticated' }
      });
      
      if (!defaultRole) {
        strapi.log.error('Default authenticated role not found');
        return ctx.internalServerError("Registration configuration error");
      }
      
      // Hash password
      const hashedPassword = await strapi.plugins['users-permissions'].services.user.hashPassword({ password });
      
      // Create user
      const newUser = await strapi.db.query('plugin::users-permissions.user').create({
        data: {
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          password: hashedPassword.password,
          role: defaultRole.id,
          confirmed: false, // Set to true if you don't want email confirmation
          blocked: false
        }
      });
      
      strapi.log.info('User registered successfully', {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email
      });
      
      // Create JWT token
      const jwt = strapi.plugins['users-permissions'].services.jwt.issue({
        id: newUser.id
      });
      
      // Send JWT as Cookie (similar to login)
      ctx.cookies.set('jwt', jwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/'
      });
      
      // Send confirmation email if needed (optional)
      if (!newUser.confirmed) {
        try {
          // Generate confirmation token
          const confirmationToken = strapi.plugins['users-permissions'].services.jwt.issue({
            id: newUser.id,
          }, {
            expiresIn: '7d' // 7 days for email confirmation
          });
          
          // Store confirmation token
          await strapi.db.query('plugin::users-permissions.user').update({
            where: { id: newUser.id },
            data: { confirmationToken }
          });
          
          // Send confirmation email
          const confirmationLink = `http://localhost:5173/confirm-email?token=${confirmationToken}`;
          
          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>Confirm Your Email</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Welcome ${newUser.username}!</h1>
              </div>
              
              <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <p style="font-size: 16px; margin-bottom: 20px;">Thank you for registering! Please confirm your email address by clicking the button below:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${confirmationLink}" style="
                    display: inline-block;
                    padding: 15px 30px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: bold;
                    font-size: 16px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                  ">Confirm Email</a>
                </div>
                
                <p style="font-size: 14px; color: #666; margin-top: 25px;">Or copy and paste this link in your browser:</p>
                <p style="font-size: 12px; background: #e9ecef; padding: 10px; border-radius: 4px; word-break: break-all;">${confirmationLink}</p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                  <p style="font-size: 14px; color: #666; margin: 0;">⚠️ This link will expire in 7 days.</p>
                  <p style="font-size: 14px; color: #666; margin: 10px 0 0 0;">If you didn't create this account, please ignore this email.</p>
                </div>
              </div>
            </body>
            </html>
          `;
          
          await strapi.plugins['email'].services.email.send({
            to: newUser.email,
            subject: 'Confirm Your Email Address',
            html: emailHtml
          });
          
          strapi.log.info('Confirmation email sent', { email: newUser.email });
        } catch (emailError) {
          strapi.log.error('Failed to send confirmation email:', emailError);
          // Don't fail the registration if email sending fails
        }
      }
      
      // Return success response
      return ctx.send({
        jwt,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          confirmed: newUser.confirmed,
          blocked: newUser.blocked
        },
        message: newUser.confirmed 
          ? "Registration successful" 
          : "Registration successful. Please check your email to confirm your account."
      });
      
    } catch (error) {
      strapi.log.error('Registration error:', {
        message: error.message,
        stack: error.stack
      });
      return ctx.badRequest("Registration failed");
    }
  },

  // Email confirmation endpoint
  async confirmEmail(ctx) {
    strapi.log.info('=== EMAIL CONFIRMATION FUNCTION CALLED ===');
    
    try {
      const { token } = ctx.request.body;
      
      if (!token) {
        return ctx.badRequest("Confirmation token is required");
      }
      
      // Verify confirmation token
      let decoded;
      try {
        decoded = strapi.plugins['users-permissions'].services.jwt.verify(token);
        strapi.log.info('Confirmation token verified:', { userId: decoded.id });
      } catch (jwtError) {
        strapi.log.error('Invalid confirmation token:', jwtError.message);
        return ctx.badRequest("Invalid or expired confirmation token");
      }
      
      if (!decoded || !decoded.id) {
        return ctx.badRequest("Invalid token payload");
      }
      
      // Find user
      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: decoded.id }
      });
      
      if (!user) {
        return ctx.badRequest("User not found");
      }
      
      if (user.confirmed) {
        return ctx.send({
          message: "Email already confirmed",
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            confirmed: user.confirmed
          }
        });
      }
      
      if (user.blocked) {
        return ctx.badRequest("User account is blocked");
      }
      
      // Confirm user
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: {
          confirmed: true,
          confirmationToken: null // Clear the confirmation token
        }
      });
      
      strapi.log.info('Email confirmed successfully for user:', user.email);
      
      // Generate new JWT for confirmed user
      const jwt = strapi.plugins['users-permissions'].services.jwt.issue({
        id: user.id
      });
      
      // Set JWT cookie
      ctx.cookies.set('jwt', jwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/'
      });
      
      return ctx.send({
        message: "Email confirmed successfully",
        jwt,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          confirmed: true,
          blocked: user.blocked
        }
      });
      
    } catch (error) {
      strapi.log.error('Email confirmation error:', {
        message: error.message,
        stack: error.stack
      });
      return ctx.badRequest("Email confirmation failed");
    }
  },
};
