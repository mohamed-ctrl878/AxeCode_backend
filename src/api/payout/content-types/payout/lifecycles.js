'use strict';

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

      // Allow event payload to carry over the existingPayout for afterUpdate
      event.state.existingPayout = existingPayout;
    }
  },

  async afterUpdate(event) {
    const { data } = event.params;
    const { existingPayout } = event.state;
    
    if (!existingPayout || !data.status) return;

    const oldStatus = existingPayout.status;
    const newStatus = data.status;

    // RULE: If Payout changes from something else TO REJECTED, refund the publisher's wallet
      if (newStatus === 'REJECTED' && oldStatus !== 'REJECTED') {
        const walletId = existingPayout.wallet?.id;
        const amount = existingPayout.amount;

        if (!walletId || !amount) {
          strapi.log.error('[Payout Lifecycle] Cannot refund missing wallet or amount');
          return;
        }

        strapi.log.info(`[Payout Lifecycle] Payout ${existingPayout.id} REJECTED. Refunding wallet ${walletId} by ${amount}`);
        
        const walletService = strapi.service('api::wallet.wallet');
        const transactionService = strapi.service('api::transaction.transaction');

        const trx = await strapi.db.connection.transaction();
        
        try {
          await walletService.creditWallet(walletId, amount, trx);
          
          await transactionService.createEntry({
              wallet: walletId,
              amount: amount,
              type: 'CREDIT',
              status: 'COMPLETED',
              reference_type: 'PAYOUT_REFUND',
              reference_id: String(existingPayout.id),
              description: `Refund for rejected payout request #${existingPayout.id}`,
          }, trx);

          await trx.commit();
          strapi.log.info(`[Payout Lifecycle] Refund completed successfully for payout ${existingPayout.id}`);

          // Emit Notification for REJECTED
          try {
            await strapi.service('api::notification.notification-emitter').emit({
              interactionType: 'payout_rejected',
              contentType: 'payout',
              docId: existingPayout.documentId,
              actorDocumentId: null, // Admin performed this, but we don't have their ID easily here
              extra: { 
                amount, 
                reason: data.rejection_reason || 'Administrative decision' 
              }
            });
          } catch (ne) { strapi.log.error(`[Payout Lifecycle] Notif failed: ${ne.message}`); }

        } catch (error) {
          await trx.rollback();
          strapi.log.error('[Payout Lifecycle] Failed to refund rejected payout:', error.message);
        }
      } else if (newStatus === 'PAID' && oldStatus !== 'PAID') {
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
