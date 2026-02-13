'use strict';

/**
 * rate controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::rate.rate', ({ strapi }) => ({
  /**
   * GET /api/rates/summary/:contentType/:docId
   */
  async summary(ctx) {
    const { contentType, docId } = ctx.params;
    
    try {
      const summary = await strapi.service('api::rate.rate').getSummary(contentType, docId);
      return ctx.send(summary);
    } catch (err) {
      return ctx.badRequest('Failed to fetch rating summary', { error: err.message });
    }
  },

  /**
   * Override create to add domain validation and "Upsert" logic
   */
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required to rate');

    const { data } = ctx.request.body;
    const { content_types, docId, rate } = data;

    // Domain Logic: Check if user can rate this content
    if (content_types === 'course') {
      const accessFacade = strapi.service('api::entitlement.content-access-facade');
      const { hasAccess } = await accessFacade.getFullDetails(docId, 'course', user.id);
      
      if (!hasAccess) {
        return ctx.forbidden('You must be enrolled in this course to rate it');
      }
    }

    // 1. Find ANY existing ratings for this user/content (to handle cleanup if multiple exist)
    const existingRates = await strapi.documents('api::rate.rate').findMany({
      filters: {
        content_types: content_types,
        docId: docId,
        users_permissions_user: { id: user.id }
      },
      status: 'published'
    });

    if (existingRates && existingRates.length > 0) {
      const existing = existingRates[0];
      
      // Strict equality check (ensuring both are numbers or same type)
      if (Number(existing.rate) === Number(rate)) {
        // TOGGLE: Same value clicked -> Delete all ratings for this user/content
        for (const r of existingRates) {
          await strapi.documents('api::rate.rate').delete({
            documentId: r.documentId,
            status: 'published'
          });
        }
        return ctx.send({ data: null, message: 'Rating removed (Toggle)' });
      } else {
        // REASSIGN: Different value clicked -> Update first one, delete others
        const updated = await strapi.documents('api::rate.rate').update({
          documentId: existing.documentId,
          data: { rate: Number(rate) },
          status: 'published'
        });

        // Cleanup: Delete any other duplicate ratings
        if (existingRates.length > 1) {
          for (let i = 1; i < existingRates.length; i++) {
            await strapi.documents('api::rate.rate').delete({
              documentId: existingRates[i].documentId,
              status: 'published'
            });
          }
        }
        
        return ctx.send({ data: updated, message: 'Rating updated (Reassign)' });
      }
    }

    // 2. No existing rating found -> Create new one
    const created = await strapi.documents('api::rate.rate').create({
      data: {
        content_types,
        docId,
        rate: Number(rate),
        users_permissions_user: user.id,
        publishedAt: new Date()
      },
      status: 'published'
    });
    
    return ctx.send({ data: created, message: 'Rating created' });
  }
}));
