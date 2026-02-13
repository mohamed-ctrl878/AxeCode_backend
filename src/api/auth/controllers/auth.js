"use strict";

module.exports = {
  // Login with JWT sent as Cookie
  async login(ctx) {
    try {
      const { identifier, password, recaptchaToken } = ctx.request.body;

      // 1. Validation Logic (SRP: Controller still handles HTTP validation)
      if (!identifier || !password) return ctx.badRequest("Missing identifier or password");

      // 2. reCAPTCHA Logic (Centralized in service - SRP/DRY)
      const recaptchaService = strapi.service("api::auth.recaptcha-service");
      if (!(await recaptchaService.validate(ctx))) {
        return ctx.badRequest("reCAPTCHA verification failed");
      }

      // 3. Business Logic (Delegated to Auth Service - SOLID: SRP & DIP)
      const authService = strapi.service("api::auth.auth-service");
      const result = await authService.login(ctx, identifier, password);

      return ctx.send(result);
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
      if (!user) return ctx.unauthorized("Not authenticated");
      return ctx.send({ user });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  // Refresh token
  async refresh(ctx) {
    try {
      const authService = strapi.service("api::auth.auth-service");
      const result = await authService.refreshToken(ctx);
      return ctx.send({ message: "Token refreshed successfully", user: result.user });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  // Check permissions
  async checkPermission(ctx) {
    try {
      const { action, subject } = ctx.request.body;
      if (!action || !subject) return ctx.badRequest("Missing action or subject");
      const authService = strapi.service("api::auth.auth-service");
      const hasPermission = await authService.checkPermission(ctx, action, subject);
      return ctx.send({ hasPermission });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  // Check role
  async checkRole(ctx) {
    try {
      const { roleName } = ctx.request.body;
      if (!roleName) return ctx.badRequest("Missing role name");
      const authService = strapi.service("api::auth.auth-service");
      const hasRole = await authService.hasRole(ctx, roleName);
      return ctx.send({ hasRole });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  // Custom registration with reCAPTCHA validation
  async register(ctx) {
    try {
      const { ...userData } = ctx.request.body;

      // 1. reCAPTCHA (Centralized in service)
      const recaptchaService = strapi.service("api::auth.recaptcha-service");
      if (!(await recaptchaService.validate(ctx))) {
        return ctx.badRequest("reCAPTCHA verification failed");
      }

      // 2. Registration Logic (Delegated to Onboarding Facade)
      const onboarding = strapi.service("api::auth.onboarding-facade");
      const result = await onboarding.fullRegistration(ctx, userData);

      return ctx.send({
        ...result,
        message: "Registration successful. Welcome to AxeCode!"
      });
    } catch (error) {
      strapi.log.error('Registration error:', error.message);
      return ctx.badRequest(error.message || "Registration failed");
    }
  },

  // Forgot Password
  async forgotPassword(ctx) {
    try {
      const { email } = ctx.request.body;
      const result = await strapi.service("api::auth.auth-service").forgotPassword(email);
      return ctx.send(result);
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  // Reset Password
  async resetPassword(ctx) {
    try {
      const { code, password } = ctx.request.body;
      const result = await strapi.service("api::auth.auth-service").resetPassword(code, password);
      return ctx.send(result);
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  // Email confirmation endpoint
  async confirmEmail(ctx) {
    strapi.log.info('=== EMAIL CONFIRMATION FUNCTION CALLED ===');
    
    try {
      const token = ctx.request.body.token || ctx.query.token || ctx.query.confirmation;
      
      if (!token) {
        return ctx.badRequest("Confirmation token is required");
      }
      
      // Verify confirmation token (SOLID: Could move this to service too in future)
      const decoded = await strapi.plugins['users-permissions'].services.jwt.verify(token);
      
      if (!decoded || !decoded.id) {
        return ctx.badRequest("Invalid token payload");
      }
      
      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: decoded.id }
      });
      
      if (!user) return ctx.notFound("User not found");
      if (user.blocked) return ctx.forbidden("User account is blocked");
      
      if (!user.confirmed) {
        await strapi.db.query('plugin::users-permissions.user').update({
          where: { id: user.id },
          data: { confirmed: true, confirmationToken: null }
        });
      }
      
      return ctx.send({ message: "Email confirmed successfully" });
      
    } catch (error) {
      strapi.log.error('Email confirmation error:', error.message);
      return ctx.badRequest("Email confirmation failed");
    }
  },
};
