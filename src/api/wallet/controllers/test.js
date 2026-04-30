'use strict';

module.exports = {
  async runTest(ctx) {
    try {
      const db = strapi.db;

      // 1. Get a random user and course
      const user = await db.query('plugin::users-permissions.user').findOne({ populate: ['wallet'] });
      const course = await db.query('api::course.course').findOne();

      if (!user || !course) {
        return ctx.send({ error: 'Need at least one user and course in DB.' });
      }

      // Ensure platform wallet exists
      await strapi.service('api::wallet.wallet').getPlatformWallet();

      const paymobId = Math.floor(Math.random() * 100000000).toString();

      // 2. Create a PENDING payment
      const payment = await strapi.documents('api::payment.payment').create({
        data: {
          paymob_id: paymobId,
          amount: 500,
          currency: 'EGP',
          status: 'PENDING',
          user: user.documentId,
          course: course.documentId,
          metadata: { test: true },
          publishedAt: new Date()
        },
        status: 'published'
      });

      // 3. Construct webhook payload
      const payload = {
        type: 'TRANSACTION',
        obj: {
          id: parseInt(paymobId),
          amount_cents: 50000,
          success: true,
          order: { id: paymobId },
        }
      };

      // 4. Trigger the service directly to process the webhook logic
      await strapi.service('api::payment.paymob').processSuccessfulPayment(payload);

      // 5. Verify the results
      const updatedPayment = await strapi.documents('api::payment.payment').findOne({
        documentId: payment.documentId
      });

      const entitlements = await strapi.documents('api::user-entitlement.user-entitlement').findMany({
        filters: { productId: course.documentId },
        populate: ['users_permissions_user']
      });

      const hasAccess = entitlements.some(e => e.users_permissions_user?.documentId === user.documentId);

      const updatedWallet = await strapi.service('api::wallet.wallet').getWalletByOwner(user.id);

      return ctx.send({
        success: true,
        test_results: {
          payment_status: updatedPayment.status,
          payment_expected: 'SUCCESS',
          entitlement_granted: hasAccess,
          wallet_balance: updatedWallet ? parseFloat(updatedWallet.balance) : 0,
        }
      });
    } catch (err) {
      strapi.log.error('Test endpoint failed', err);
      return ctx.send({ success: false, error: err.message });
    }
  }
};
