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

    // Check completion status
    let isCompleted = false;
    if (userId) {
      const progress = await strapi.documents('api::user-progress.user-progress').findFirst({
        filters: {
          users_permissions_user: { documentId: userId },
          lesson: { documentId: lesson.documentId },
          status: 'completed'
        }
      });
      isCompleted = !!progress;
    }

    return {
      ...lesson,
      interactions: socialMetadata,
      isCompleted
    };
  }
}));
