'use strict';

/**
 * lesson service
 * Handles enrichment logic only.
 * Draft/Published is managed by Strapi core.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::lesson.lesson', ({ strapi }) => ({
  /**
   * Enriches a lesson with interaction metadata
   */
  async enrichLesson(lesson, userId) {
    const interactionFacade = strapi.service('api::rate.interaction-facade');
    const socialMetadata = await interactionFacade.getMetadata('lesson', lesson.documentId, userId);

    return {
      ...lesson,
      interactions: socialMetadata
    };
  }
}));
