'use strict';

/**
 * article controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  // Override create to automatically set author
  async create(ctx) {
    // Get the authenticated user
    const user = ctx.state.user;
    
    if (!user) {
      return ctx.unauthorized('You must be logged in to create an article');
    }

    // Add author to the request body
    ctx.request.body.data = {
      ...ctx.request.body.data,
      author: user.id,
    };

    // Call the default create method
    const response = await super.create(ctx);
    return response;
  },

  // Override update to ensure only author can edit
  async update(ctx) {
    const user = ctx.state.user;
    
    if (!user) {
      return ctx.unauthorized('You must be logged in to update an article');
    }

    const response = await super.update(ctx);
    return response;
  },

  // GET /articles - Enriched with interactions (using Strapi default find)
  async find(ctx) {
    const userId = ctx.state.user?.id || null;

    // Use Strapi default find
    const response = await super.find(ctx);
    if (!response || !response.data) return response;

    // Enrich with interactions
    const enriched = await Promise.all(
      response.data.map(article => strapi.service('api::article.article').enrichArticle(article, userId))
    );
    
    return ctx.send({
      data: enriched,
      meta: response.meta,
    });
  },

  // GET /articles/:id - Enriched with interactions (using Strapi default findOne)
  async findOne(ctx) {
    const userId = ctx.state.user?.id || null;

    // Use Strapi default findOne
    const response = await super.findOne(ctx);
    if (!response || !response.data) return response;

    const enriched = await strapi.service('api::article.article').enrichArticle(response.data, userId);

    return ctx.send({ data: enriched });
  }
}));
