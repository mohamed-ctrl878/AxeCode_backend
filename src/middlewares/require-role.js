"use strict";

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    try {
      const { roleName } = config;

      if (!roleName) {
        return ctx.badRequest("Missing role configuration");
      }

      // التحقق من وجود المستخدم
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication required");
      }

      // التحقق من الدور
      const authService = strapi.service("api::auth.auth-service");
      const hasRole = await authService.hasRole(ctx, roleName);

      if (!hasRole) {
        return ctx.forbidden(`Role required: ${roleName}`);
      }

      await next();
    } catch (error) {
      return ctx.forbidden("Role check failed");
    }
  };
};
