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
        const response = await super.create(ctx);
        
        // 5. Trigger notification
        try {
            let snippet = 'New comment';
            const commentData = ctx.request.body.data.comment;
            
            // Extract text from Strapi Blocks (array of objects)
            if (Array.isArray(commentData) && commentData.length > 0) {
                const firstBlock = commentData[0];
                if (firstBlock.children && firstBlock.children.length > 0) {
                    const textContent = firstBlock.children[0].text;
                    if (textContent) {
                        snippet = textContent.substring(0, 50);
                    }
                }
            }

            await strapi.service('api::notification.notification-emitter').emit({
                interactionType: 'comment',
                contentType: ctx.request.body.data.content_types,
                docId: ctx.request.body.data.docId,
                actorDocumentId: user.documentId,
                extra: { snippet },
            });
        } catch (e) {
            strapi.log.error('Comment Notification Emit failed: ', e);
        }

        return response;
    }
}));
