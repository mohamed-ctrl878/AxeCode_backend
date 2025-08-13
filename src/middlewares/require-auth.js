"use strict";

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    try {
      // التحقق من وجود المستخدم في context
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication required");
      }

      // التحقق من أن المستخدم غير محظور
      if (ctx.state.user.blocked) {
        return ctx.forbidden("User is blocked");
      }

      // التحقق من تأكيد البريد الإلكتروني
      if (!ctx.state.user.confirmed) {
        return ctx.forbidden("Email not confirmed");
      }

      await next();
    } catch (error) {
      return ctx.unauthorized("Authentication failed");
    }
  };
};
