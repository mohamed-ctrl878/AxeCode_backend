"use strict";

module.exports = {
  // تسجيل الدخول مع إرسال JWT كـ Cookie
  async login(ctx) {
    try {
      const { identifier, password } = ctx.request.body;

      if (!identifier || !password) {
        return ctx.badRequest("Missing identifier or password");
      }

      // البحث عن المستخدم
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { email: identifier },
        });

      if (!user) {
        return ctx.unauthorized("User not found");
      }

      // التحقق من كلمة المرور
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

      // إنشاء JWT
      const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
        id: user.id,
      });

      // إرسال JWT كـ Cookie
      ctx.cookies.set("jwt", jwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 يوم
        path: "/",
      });

      // إرجاع بيانات المستخدم وJWT في body أيضاً
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

  // تسجيل الخروج
  async logout(ctx) {
    try {
      const authService = strapi.service("api::auth.auth-service");
      const result = await authService.logout(ctx);

      return ctx.send(result);
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },

  // الحصول على المستخدم الحالي
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

  // تحديث الـ token
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

  // التحقق من الصلاحيات
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

  // التحقق من الدور
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
