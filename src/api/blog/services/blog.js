'use strict';

/**
 * blog service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::blog.blog', ({ strapi }) => ({
  async findForUser(params, userId = null) {
    const { results, pagination } = await super.find(params);
    
    const enrichedResults = await Promise.all(
      results.map(async (blog) => this.enrichBlog(blog, userId))
    );
    
    return { results: enrichedResults, pagination };
  },

  async findOneForUser(documentId, userId = null) {
    const blog = await strapi.documents('api::blog.blog').findOne({
      documentId,
      populate: ['image', 'publisher', 'publisher.avatar']
    });

    return this.enrichBlog(blog, userId);
  },

  async enrichBlog(blog, userId = null) {
    if (!blog) return null;
    const interactionFacade = strapi.service('api::rate.interaction-facade');
    const interactions = await interactionFacade.getMetadata('blog', blog.documentId, userId);
    
    return {
      ...blog,
      interactions
    };
  }
}));
