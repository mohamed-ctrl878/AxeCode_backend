'use strict';

/**
 * article service
 * Handles enrichment logic only.
 * Draft/Published is managed by Strapi core.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::article.article', ({ strapi }) => ({
  /**
   * Enriches an article with interaction metadata
   */
  async enrichArticle(article, userId) {
    const interactionFacade = strapi.service('api::rate.interaction-facade');
    const socialMetadata = await interactionFacade.getMetadata('article', article.documentId, userId);

    return {
      ...article,
      interactions: socialMetadata
    };
  }
}));
