'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::push-subscription.push-subscription', ({ strapi }) => ({
  async subscribe(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { endpoint, keys, browser_type } = ctx.request.body;
    
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return ctx.badRequest('Missing required subscription data');
    }

    // Check if exists
    const existing = await strapi.documents('api::push-subscription.push-subscription').findFirst({
      filters: { endpoint, user: user.documentId }
    });

    if (existing) {
      // update keys if changed and make active
      const updated = await strapi.documents('api::push-subscription.push-subscription').update({
        documentId: existing.documentId,
        data: {
          p256dh_key: keys.p256dh,
          auth_key: keys.auth,
          is_active: true,
          browser_type
        }
      });
      return { message: 'Subscription updated', data: updated };
    }

    // Create new
    const sub = await strapi.documents('api::push-subscription.push-subscription').create({
      data: {
        user: user.documentId,
        endpoint,
        p256dh_key: keys.p256dh,
        auth_key: keys.auth,
        is_active: true,
        browser_type,
        publishedAt: new Date()
      },
      status: 'published'
    });

    return { message: 'Subscribed successfully', data: sub };
  },

  async unsubscribe(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized();

    const { endpoint } = ctx.request.body;
    if (!endpoint) return ctx.badRequest('Endpoint required to unsubscribe');

    const existing = await strapi.documents('api::push-subscription.push-subscription').findFirst({
      filters: { endpoint, user: user.documentId }
    });

    if (existing) {
      await strapi.documents('api::push-subscription.push-subscription').delete({
        documentId: existing.documentId
      });
      return { message: 'Unsubscribed successfully' };
    }

    return ctx.notFound('Subscription not found');
  }
}));
