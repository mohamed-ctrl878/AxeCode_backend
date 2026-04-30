'use strict';

/**
 * payout service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::payout.payout', ({ strapi }) => ({

    /**
     * Handle a new payout request
     * @param {number} userId - The user requesting payout
     * @param {number} amount - Amount requested
     * @param {string} method - Payout method
     * @param {object} details - Bank/Transfer details
     */
    async requestPayout(userId, amount, method, details) {
        if (!amount || amount < 100) {
            throw new Error('Minimum payout amount is 100');
        }

        const walletService = strapi.service('api::wallet.wallet');
        const transactionService = strapi.service('api::transaction.transaction');

        // Need the user's wallet
        const wallet = await walletService.findOrCreateWallet(userId, 'publisher');
        
        // Start a database transaction for safe deduction
        const trx = await strapi.db.connection.transaction();

        try {
            // Deduct the requested amount using pessimistic locking mechanism in walletService
            await walletService.debitWallet(wallet.id, amount, trx);

            // Record the transaction locally (Debit for payout)
            const transactionRecord = await transactionService.createEntry({
                wallet: wallet.id,
                amount: amount,
                type: 'DEBIT',
                status: 'COMPLETED',
                reference_type: 'PAYOUT_REQUEST',
                reference_id: `user-${userId}-${Date.now()}`,
                description: `Payout request via ${method}`,
            }, trx);

            // Create the payout object
            const payout = await strapi.db.query('api::payout.payout').create({
                data: {
                    amount: amount,
                    status: 'PENDING',
                    method: method,
                    details: details,
                    wallet: wallet.id,
                    users_permissions_user: userId
                }
            });

            // Commit atomic operations
            await trx.commit();
            return payout;
        } catch (error) {
            await trx.rollback();
            strapi.log.error('[Payout Service] Payout Request Failed:', error.message);
            throw new Error(`Failed to process payout: ${error.message}`);
        }
    }
}));
