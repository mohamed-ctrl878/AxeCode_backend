'use strict';

/**
 * like controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::like.like', ({ strapi }) => ({
  /**
   * POST /api/likes/toggle
   * Atomic operation to toggle like and return new state + count
   */
  async toggle(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');
    console.debug("user", user);

    const { content_types, docId } = ctx.request.body.data;
    if (!content_types || !docId) return ctx.badRequest('contentType and docId are required');

    try {
      // 1. Check if like exists
      const existing = await strapi.db.query('api::like.like').findOne({
        where: {
          content_types: content_types,
          docId: docId,
          users_permissions_user: { documentId: user.documentId }
        }
      });

      if (existing) {
        // Remove like
        await strapi.documents('api::like.like').delete({
          documentId: existing.documentId,
          status: 'published'
        });
      } else {
        // Add like
        await strapi.documents('api::like.like').create({
          data: {
            content_types: content_types,
            docId: docId,
            users_permissions_user: user.documentId,
            publishedAt: new Date(),
          },
          status: 'published'
        });

        // Trigger notification
        await strapi.service('api::notification.notification-emitter').emit({
          interactionType: 'like',
          contentType: content_types,
          docId,
          actorDocumentId: user.documentId,
        });
      }

      // 2. Get fresh interaction metadata via Facade
      const facade = strapi.service('api::rate.interaction-facade');
      const metadata = await facade.getMetadata(content_types, docId, user.documentId);

      return ctx.send({
        liked: !existing,
        count: metadata.likesCount,
        metadata
      });
    } catch (err) {
      return ctx.badRequest('Toggle like failed', { error: err.message });
    }
  }
}));
