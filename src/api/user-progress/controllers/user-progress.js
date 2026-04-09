'use strict';

/**
 * user-progress controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::user-progress.user-progress', ({ strapi }) => ({
  /**
   * Custom update/upsert logic for user progress.
   * Ensures one record per user/lesson.
   */
  async updateProgress(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { lessonId, courseId, status, lastWatched } = ctx.request.body.data;
    if (!lessonId || !courseId) return ctx.badRequest('lessonId and courseId are required');

    // 1. Check if progress record exists using Document Service (handles documentId natively)
    const existing = await strapi.documents('api::user-progress.user-progress').findFirst({
      filters: {
        users_permissions_user: { documentId: user.documentId },
        lesson: { documentId: lessonId }
      }
    });

    if (existing) {
      // 2. Update existing
      const updated = await strapi.documents('api::user-progress.user-progress').update({
        documentId: existing.documentId,
        data: {
          status: status || existing.status,
          last_watched: lastWatched ?? existing.last_watched,
          course: courseId // Strapi v5 handles documentId in relations
        }
      });
      return ctx.send({ data: updated });
    } else {
      // 3. Create new
      const created = await strapi.documents('api::user-progress.user-progress').create({
        data: {
          users_permissions_user: user.documentId,
          lesson: lessonId,
          course: courseId,
          status: status || 'in-progress',
          last_watched: lastWatched || 0
        }
      });
      return ctx.send({ data: created });
    }
  }
}));
