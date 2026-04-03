'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::notification.notification', ({ strapi }) => ({
  /**
   * Get notifications for the current user
   */
  async mine(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }

    const { query } = ctx;

    const notifications = await strapi.documents('api::notification.notification').findMany({
      ...query,
      filters: {
        ...(query.filters || {}),
        owner: { documentId: user.documentId }
      },
      populate: ['actor'],
      sort: 'createdAt:desc',
      status: 'published'
    });

    return { results: notifications };
  },

  /**
   * Get unread count
   */
  async unreadCount(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }

    const count = await strapi.documents('api::notification.notification').count({
      filters: { owner: { documentId: user.documentId }, read: false },
      status: 'published'
    });

    return { unreadCount: count };
  },

  /**
   * Mark a single notification as read
   */
  async read(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;

    if (!user) {
      return ctx.unauthorized();
    }

    // Verify ownership
    const notification = await strapi.documents('api::notification.notification').findFirst({
      filters: { documentId: id, owner: { documentId: user.documentId } },
      status: 'published'
    });

    if (!notification) {
      return ctx.notFound();
    }

    const updated = await strapi.documents('api::notification.notification').update({
      documentId: id,
      data: { read: true },
      status: 'published'
    });

    return updated;
  },

  /**
   * Mark all notifications as read for current user
   */
  async readAll(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized();
    }

    const unreadNotifications = await strapi.documents('api::notification.notification').findMany({
      filters: { owner: { documentId: user.documentId }, read: false },
      select: ['documentId'],
      status: 'published'
    });

    let updatedCount = 0;
    for (const notif of unreadNotifications) {
       await strapi.documents('api::notification.notification').update({
         documentId: notif.documentId,
         data: { read: true },
         status: 'published'
       });
       updatedCount++;
    }

    return { message: 'success', markedAsRead: updatedCount };
  }
}));
