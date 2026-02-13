'use strict';

/**
 * problem controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::problem.problem', ({ strapi }) => ({
  async find(ctx) {
    const userId = ctx.state.user?.id || null;
    const response = await super.find(ctx);
    if (!response || !response.data) return response;
    
    const enriched = await Promise.all(
      response.data.map(async (problem) => strapi.service('api::problem.problem').enrichProblem(problem, userId))
    );
    
    return { data: enriched, meta: response.meta };
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user?.id || null;
    
    // Use super.findOne to benefit from default Strapi handling (including ?populate=*)
    const response = await super.findOne(ctx);
    if (!response || !response.data) return response;

    // Enrich the result with interaction metadata
    const enriched = await strapi.service('api::problem.problem').enrichProblem(response.data, userId);
    
    return { data: enriched };
  }
}));
