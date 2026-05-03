'use strict';

/**
 * payout controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::payout.payout', ({ strapi }) => ({
    
    /**
     * Request a new payout via POST /api/payouts/request
     */
    async request(ctx) {
        const user = ctx.state.user;
        if (!user) {
            return ctx.unauthorized('You must be logged in to request a payout.');
        }

        const { amount, method, details } = ctx.request.body;

        if (!amount || !method || !details) {
            return ctx.badRequest('amount, method, and details are required.');
        }

        try {
            const payout = await strapi.service('api::payout.payout').requestPayout(user.id, amount, method, details);
            
            // Emit notification to confirming the request
            try {
                await strapi.service('api::notification.notification-emitter').emit({
                    interactionType: 'payout_request',
                    contentType: 'payout',
                    docId: payout.document_id,  // Raw Knex returns snake_case
                    actorDocumentId: user.documentId,
                    extra: { amount }
                });
                
                // 2. Notify Admins
                await strapi.service('api::notification.admin-notification').emit({
                    type: 'payout_requested',
                    contentType: 'payout',
                    docId: payout.document_id,
                    actorDocumentId: user.documentId,
                    extra: { amount }
                });
            } catch (notifErr) {
                strapi.log.error(`[Payout] Notification failed: ${notifErr.message}`);
            }

            return ctx.send({
                message: 'Payout request created successfully',
                data: payout
            });
        } catch (error) {
            // Check if error is insufficient funds from debitWallet
            if (error.message.includes('Insufficient funds')) {
                return ctx.badRequest(error.message);
            }
            if (error.message.includes('Minimum payout')) {
                return ctx.badRequest(error.message);
            }
            return ctx.internalServerError('Failed to process payout request');
        }
    }
}));
