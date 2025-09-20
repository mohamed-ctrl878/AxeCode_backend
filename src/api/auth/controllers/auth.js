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
};
