"use strict";

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    const path = ctx.request.path || '';

    // OAuth connect/callback routes must remain public (unauthenticated).
    // Injecting a JWT here would cause Strapi to check the Authenticated role,
    // which doesn't have the connect permission → 403 Forbidden.
    const isOAuthRoute = path.startsWith('/api/connect') || path.includes('/auth/github/callback');

    if (!isOAuthRoute && !ctx.request.header.authorization && ctx.cookies.get("jwt")) {
      ctx.request.header.authorization = `Bearer ${ctx.cookies.get("jwt")}`;
    }

    await next();
  };
};
