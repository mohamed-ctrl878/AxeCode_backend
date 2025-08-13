"use strict";

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    try {
      const { action, subject } = config;

      if (!action || !subject) {
        return ctx.badRequest("Missing permission configuration");
      }

      // التحقق من وجود المستخدم
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication required");
      }

      // التحقق من الصلاحية
      const authService = strapi.service("api::auth.auth-service");
      const hasPermission = await authService.checkPermission(
        ctx,
        action,
        subject
      );

      if (!hasPermission) {
        return ctx.forbidden(
          `Insufficient permissions: ${action} on ${subject}`
        );
      }

      await next();
    } catch (error) {
      return ctx.forbidden("Permission check failed");
    }
  };
};
