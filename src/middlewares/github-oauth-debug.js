'use strict';

/**
 * GitHub OAuth Debug Middleware
 * Intercepts the /api/connect/github/callback route to log exactly what happens.
 * This runs BEFORE the grant library processes the callback.
 */
module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    const url = ctx.request.url;

    // Only log for OAuth connect routes
    if (url.includes('/connect/github')) {
      strapi.log.info(`\n========== [GITHUB OAUTH DEBUG] ==========`);
      strapi.log.info(`URL: ${ctx.request.method} ${url}`);
      strapi.log.info(`Query: ${JSON.stringify(ctx.query)}`);
      strapi.log.info(`Session exists: ${!!ctx.session}`);
      if (ctx.session) {
        strapi.log.info(`Session grant data: ${JSON.stringify(ctx.session.grant || 'EMPTY')}`);
      }
      strapi.log.info(`===========================================\n`);
    }

    try {
      await next();
    } catch (err) {
      if (url.includes('/connect/github')) {
        strapi.log.error(`\n========== [GITHUB OAUTH ERROR] ==========`);
        strapi.log.error(`URL: ${url}`);
        strapi.log.error(`Error: ${err.message}`);
        strapi.log.error(`Stack: ${err.stack}`);
        strapi.log.error(`===========================================\n`);
      }
      throw err;
    }

    // After next() — log the response status and any redirect
    if (url.includes('/connect/github')) {
      strapi.log.info(`\n========== [GITHUB OAUTH RESPONSE] ==========`);
      strapi.log.info(`URL: ${url}`);
      strapi.log.info(`Status: ${ctx.status}`);
      strapi.log.info(`Redirect Location: ${ctx.response.headers?.location || 'NONE'}`);
      strapi.log.info(`Response body type: ${typeof ctx.body}`);
      if (ctx.status >= 300 && ctx.status < 400) {
        strapi.log.info(`REDIRECT TO: ${ctx.response.headers?.location || ctx.redirect}`);
      }
      strapi.log.info(`===============================================\n`);
    }
  };
};
