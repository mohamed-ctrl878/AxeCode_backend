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

        // 3. SECURE OVERRIDE: Prevent client from setting the user ID directly.
        // We delete it so Zod validation doesn't throw 'Invalid key users_permissions_user'.
        if (ctx.request.body.data.users_permissions_user) {
            delete ctx.request.body.data.users_permissions_user;
        }

        // Ensure it gets published immediately
        ctx.request.body.data.publishedAt = new Date();

        // 4. Call the default core action to cleanly validate and create the comment
        const response = await super.create(ctx);
        
        // 4.5. Securely attach the user to the newly created comment via DB Query API
        // This cleanly avoids ANY Zod validation errors about relations format and accepts raw numeric IDs natively.
        await strapi.db.query('api::comment.comment').update({
            where: { id: response.data.id },
            data: {
                users_permissions_user: user.id
            }
        });
        
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
