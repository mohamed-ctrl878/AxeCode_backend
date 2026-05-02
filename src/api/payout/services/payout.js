'use strict';

/**
 * Payout Service — Hold/Freeze Pattern
 * 
 * When a publisher requests a payout:
 * 1. HOLD: Freeze the amount in pending_balance (balance untouched)
 * 2. Admin APPROVES → confirmDebit: Deduct from balance + release hold
 * 3. Admin REJECTS  → releaseHold: Unfreeze pending_balance (no debit)
 */

const { createCoreService } = require('@strapi/strapi').factories;
const crypto = require('crypto');

module.exports = createCoreService('api::payout.payout', ({ strapi }) => ({

    /**
     * Handle a new payout request using Hold/Freeze pattern.
     * 
     * @param {number} userId - The user requesting payout
     * @param {number} amount - Amount requested
     * @param {string} method - Payout method (InstaPay, Bank Transfer, etc.)
     * @param {object} details - Bank/Transfer details
     */
    async requestPayout(userId, amount, method, details) {
        if (!amount || amount < 100) {
            throw new Error('Minimum payout amount is 100');
        }

        const walletService = strapi.service('api::wallet.wallet');

        // Find the publisher's wallet
        const wallet = await walletService.findOrCreateWallet(userId, 'publisher');
        
        // Start a database transaction for atomic hold + payout creation
        const trx = await strapi.db.connection.transaction();

        try {
            // ── Step 1: HOLD the amount (freeze in pending_balance) ──────
            // Balance stays the same, but available = balance - pending_balance decreases.
            // This prevents the publisher from spending these funds elsewhere.
            await walletService.holdBalance(wallet.id, amount, trx);

            // ── Step 2: Create the payout record ────────────────────────
            // Using raw Knex inside the same transaction to avoid deadlocks
            const documentId = crypto.randomUUID();

            const [payoutResult] = await trx('payouts').insert({
                document_id: documentId,
                amount: amount,
                status: 'PENDING',
                method: method,
                details: typeof details === 'string' ? details : JSON.stringify(details),
                created_at: new Date(),
                updated_at: new Date()
            }).returning('*');

            const payout = payoutResult;

            // Link payout → wallet (Strapi v5 join table)
            await trx('payouts_wallet_lnk').insert({
                payout_id: payout.id,
                wallet_id: wallet.id
            });

            // Link payout → user (Strapi v5 join table)
            await trx('payouts_users_permissions_user_lnk').insert({
                payout_id: payout.id,
                user_id: userId
            });

            // ── Step 3: Commit all operations atomically ─────────────────
            await trx.commit();

            strapi.log.info(`[Payout] Request #${payout.id} created: ${amount} via ${method} — funds HELD (not debited)`);
            return payout;
        } catch (error) {
            await trx.rollback();
            strapi.log.error('[Payout Service] Payout Request Failed:', error.message);
            throw new Error(`Failed to process payout: ${error.message}`);
        }
    }
}));
