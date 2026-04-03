'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::notification-preference.notification-preference', ({ strapi }) => ({
  async getMyPreferences(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    let pref = await strapi.documents('api::notification-preference.notification-preference').findFirst({
      filters: { user: user.documentId }
    });

    if (!pref) {
      // Return default
      return { disabled_topics: [] };
    }

    return pref;
  },

  async updateMyPreferences(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { disabled_topics } = ctx.request.body;

    if (!Array.isArray(disabled_topics)) {
      return ctx.badRequest('disabled_topics must be an array');
    }

    let pref = await strapi.documents('api::notification-preference.notification-preference').findFirst({
      filters: { user: user.documentId }
    });

    if (pref) {
      pref = await strapi.documents('api::notification-preference.notification-preference').update({
        documentId: pref.documentId,
        data: { disabled_topics }
      });
    } else {
      pref = await strapi.documents('api::notification-preference.notification-preference').create({
        data: {
          user: user.documentId,
          disabled_topics,
          publishedAt: new Date()
        },
        status: 'published'
      });
    }

    return pref;
  }
}));
