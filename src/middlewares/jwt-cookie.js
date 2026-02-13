"use strict";

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    // إذا لم يوجد Authorization header لكن يوجد كوكي jwt
    if (!ctx.request.header.authorization && ctx.cookies.get("jwt")) {
      ctx.request.header.authorization = `Bearer ${ctx.cookies.get("jwt")}`;
    }
    await next(); 
  };
};
