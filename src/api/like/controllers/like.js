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
      // 1. Check if like exists using the numeric user.id (because DB mapping table explicitly joins on the integer ID)
      const existing = await strapi.db.query('api::like.like').findOne({
        where: {
          content_types,
          docId,
          users_permissions_user: user.id
        }
      });

      let updatedLike;

      if (existing) {
        // Unlike (Delete)
        await strapi.db.query('api::like.like').delete({
          where: { id: existing.id }
        });
        updatedLike = null;
      } else {
        // Like (Create) - Use user.id for native DB creation
        updatedLike = await strapi.db.query('api::like.like').create({
          data: {
            content_types,
            docId,
            users_permissions_user: user.id,
            publishedAt: new Date(),
          }
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
