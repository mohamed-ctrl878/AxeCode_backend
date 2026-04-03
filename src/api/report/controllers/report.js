'use strict';

/**
 * report controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::report.report', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized("You must be logged in to report.");
    }

    if (!ctx.request.body.data) {
      ctx.request.body = { data: ctx.request.body };
    }

    // Assign the reporter safely
    ctx.request.body.data.users_permissions_user = user.documentId;
    ctx.request.body.data.publishedAt = new Date();

    const response = await super.create(ctx);

    const { content_type, docId, description } = ctx.request.body.data;

    try {
      // 1. Report Notification to Owner (Anonymous)
      await strapi.service('api::notification.notification-emitter').emit({
        interactionType: 'report',
        contentType: content_type,
        docId: docId,
        actorDocumentId: null, // Passing null makes the actor anonymous
      });

      // 2. Detailed Report Notification to Admins
      await strapi.service('api::notification.admin-notification').emit({
        type: 'content_reported',
        contentType: content_type,
        docId: docId,
        actorDocumentId: user.documentId, // Admin sees exact reporter
        extra: { reason: description }
      });
    } catch (e) {
      strapi.log.error('Report Notification Emit failed: ', e);
    }

    return response;
  }
}));
