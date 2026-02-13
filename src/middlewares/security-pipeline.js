'use strict';

/**
 * Security Pipeline Middleware
 * Bridges HTTP requests with the SecurityPipeline service for 
 * parallel and efficient security checks.
 */

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    const pipeline = strapi.service('api::auth.security-pipeline');

    try {
      // Execute the security pipeline (Rate Limit -> Validation -> Auth)
      await pipeline.run(ctx);
      
      // If everything passes, move to the next middleware/controller
      await next();
    } catch (error) {
      // The pipeline throws specific Strapi errors (ctx.tooManyRequests, ctx.badRequest, etc.)
      // which Strapi's error handler will format correctly for the client.
      throw error;
    }
  };
};
