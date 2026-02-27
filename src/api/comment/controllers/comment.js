'use strict';

/**
 * comment controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::comment.comment', ({ strapi }) => ({
    async create(ctx) {
        // 1. Strictly authenticate via server-side JWT context
        const user = ctx.state.user;
        if (!user) {
            return ctx.unauthorized("You must be logged in to comment.");
        }

        // 2. Ensure data wrapper exists
        if (!ctx.request.body.data) {
            ctx.request.body = { data: ctx.request.body };
        }

        // 3. SECURE OVERRIDE: Ignore any client-provided user IDs.
        // Forcefully connect the verified server-side user ID to the comment.
        ctx.request.body.data.users_permissions_user = user.documentId;

        // Ensure it gets published immediately
        ctx.request.body.data.publishedAt = new Date();

        // 4. Call the default core action with the tampered secure payload
        return await super.create(ctx);
    }
}));
