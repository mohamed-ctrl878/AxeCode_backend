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

    const { content_types, docId } = ctx.request.body.data;
    if (!content_types || !docId) return ctx.badRequest('contentType and docId are required');

    try {
      // 1. Check if like exists
      const existing = await strapi.documents('api::like.like').findFirst({
        filters: {
          content_types: content_types,
          docId: docId,
          users_permissions_user: { id: user.id }
        },
        status: 'published'
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
            users_permissions_user: user.id,
            publishedAt: new Date(),
          },
          status: 'published'
        });
      }

      // 2. Get fresh interaction metadata via Facade
      const facade = strapi.service('api::rate.interaction-facade');
      const metadata = await facade.getMetadata(content_types, docId, user.id);

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
