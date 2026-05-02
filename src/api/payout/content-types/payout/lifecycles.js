'use strict';

/**
 * Payout Lifecycles — Hold/Freeze Pattern
 * 
 * Handles status transitions:
 * - PENDING → APPROVED/PAID: confirmDebit (actual deduction) + ledger entry
 * - PENDING → REJECTED: releaseHold (unfreeze) — no money moves
 */

module.exports = {
  async beforeUpdate(event) {
    const { data, where } = event.params;
    
    // Check if status is being updated
    if (data.status) {
      // Fetch the existing payout to see what the OLD status is
      const existingPayout = await strapi.db.query('api::payout.payout').findOne({
        where,
        populate: ['wallet']
      });

      if (!existingPayout) return;

      // Carry over the existingPayout for afterUpdate
      event.state.existingPayout = existingPayout;
    }
  },

  async afterUpdate(event) {
    const { data } = event.params;
    const { existingPayout } = event.state;
    
    if (!existingPayout || !data.status) return;

    const oldStatus = existingPayout.status;
    const newStatus = data.status;

    // ── REJECTED: Release the hold (unfreeze funds, no debit) ──────────
    if (newStatus === 'REJECTED' && oldStatus !== 'REJECTED') {
      const walletId = existingPayout.wallet?.id;
      const amount = parseFloat(existingPayout.amount);

      if (!walletId || !amount) {
        strapi.log.error('[Payout Lifecycle] Cannot release hold: missing wallet or amount');
        return;
      }

      strapi.log.info(`[Payout Lifecycle] Payout #${existingPayout.id} REJECTED → releasing hold of ${amount}`);
      
      const walletService = strapi.service('api::wallet.wallet');
      const trx = await strapi.db.connection.transaction();
      
      try {
        // Simply unfreeze the pending_balance — balance stays untouched
        await walletService.releaseHold(walletId, amount, trx);
        await trx.commit();
        strapi.log.info(`[Payout Lifecycle] Hold released successfully for payout #${existingPayout.id}`);
      } catch (error) {
        await trx.rollback();
        strapi.log.error(`[Payout Lifecycle] Failed to release hold: ${error.message}`);
      }

      // Emit Notification for REJECTED
      try {
        await strapi.service('api::notification.notification-emitter').emit({
          interactionType: 'payout_rejected',
          contentType: 'payout',
          docId: existingPayout.documentId,
          actorDocumentId: null,
          extra: { 
            amount, 
            reason: data.rejection_reason || 'Administrative decision' 
          }
        });
      } catch (ne) { strapi.log.error(`[Payout Lifecycle] Notif failed: ${ne.message}`); }
    }

    // ── APPROVED or PAID: Confirm the debit (actual balance deduction) ──
    else if ((newStatus === 'APPROVED' || newStatus === 'PAID') && oldStatus === 'PENDING') {
      const walletId = existingPayout.wallet?.id;
      const amount = parseFloat(existingPayout.amount);

      if (!walletId || !amount) {
        strapi.log.error('[Payout Lifecycle] Cannot confirm debit: missing wallet or amount');
        return;
      }

      strapi.log.info(`[Payout Lifecycle] Payout #${existingPayout.id} ${newStatus} → confirming debit of ${amount}`);

      const walletService = strapi.service('api::wallet.wallet');
      const transactionService = strapi.service('api::transaction.transaction');
      const trx = await strapi.db.connection.transaction();

      try {
        // Now actually deduct from balance AND release the hold
        await walletService.confirmDebit(walletId, amount, trx);
        
        // Record in the immutable ledger — this is the REAL financial event
        await transactionService.createEntry({
          wallet: walletId,
          amount: amount,
          type: 'DEBIT',
          status: 'COMPLETED',
          reference_type: 'PAYOUT',
          reference_id: String(existingPayout.id),
          description: `Payout #${existingPayout.id} approved — ${amount} via ${existingPayout.method}`,
        }, trx);

        await trx.commit();
        strapi.log.info(`[Payout Lifecycle] Debit confirmed for payout #${existingPayout.id}`);
      } catch (error) {
        await trx.rollback();
        strapi.log.error(`[Payout Lifecycle] Failed to confirm debit: ${error.message}`);
      }

      // Emit Notification for PAID
      try {
        await strapi.service('api::notification.notification-emitter').emit({
          interactionType: 'payout_paid',
          contentType: 'payout',
          docId: existingPayout.documentId,
          actorDocumentId: null,
          extra: { amount: existingPayout.amount }
        });
      } catch (ne) { strapi.log.error(`[Payout Lifecycle] Notif failed: ${ne.message}`); }
    }
  }
};
