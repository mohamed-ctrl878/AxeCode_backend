'use strict';

/**
 * Transaction Controller (Read-Only)
 * 
 * No create/update/delete from API — transactions are created
 * only through internal services (wallet operations).
 * 
 * - Publisher: sees only transactions for their own wallet
 * - Admin: sees all transactions
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::transaction.transaction', ({ strapi }) => ({

  /**
   * GET /api/transactions
   * Returns transactions for the authenticated user's wallet,
   * or all transactions for admin.
   */
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { page = 1, pageSize = 25, type, status, reference_type } = ctx.query;

    try {
      // Find the user's wallet
      const wallet = await strapi.service('api::wallet.wallet')
        .getWalletByOwner(user.id);

      if (!wallet) {
        return ctx.send({
          data: [],
          meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } },
        });
      }

      const result = await strapi.service('api::transaction.transaction')
        .findByWallet(wallet.id, {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          type,
          status,
          reference_type,
        });

      return ctx.send({
        data: result.data.map(t => ({
          id: t.id,
          documentId: t.documentId,
          amount: t.amount,
          type: t.type,
          status: t.status,
          reference_type: t.reference_type,
          reference_id: t.reference_id,
          payment_id: t.payment_id,
          description: t.description,
          metadata: t.metadata,
          createdAt: t.createdAt || t.created_at,
        })),
        meta: { pagination: result.pagination },
      });
    } catch (error) {
      strapi.log.error('[Transaction Controller] find() failed:', error.message);
      return ctx.internalServerError('Failed to fetch transactions');
    }
  },

  /**
   * GET /api/transactions/summary
   * Returns wallet summary with calculated balance and recent transactions.
   */
  async summary(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    try {
      const wallet = await strapi.service('api::wallet.wallet')
        .getWalletByOwner(user.id);

      if (!wallet) {
        return ctx.send({
          data: {
            total_credits: 0,
            total_debits: 0,
            calculated_balance: 0,
            recent: [],
            total_transactions: 0,
          },
        });
      }

      const summary = await strapi.service('api::transaction.transaction')
        .getWalletSummary(wallet.id);

      return ctx.send({ data: summary });
    } catch (error) {
      strapi.log.error('[Transaction Controller] summary() failed:', error.message);
      return ctx.internalServerError('Failed to fetch transaction summary');
    }
  },

  /**
   * GET /api/transactions/:id
   * Returns a single transaction — ownership is verified.
   */
  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id } = ctx.params;

    try {
      const transaction = await strapi.db.query('api::transaction.transaction').findOne({
        where: { id },
        populate: ['wallet'],
      });

      if (!transaction) return ctx.notFound('Transaction not found');

      // Ownership check — publisher can only see their own wallet's transactions
      const wallet = await strapi.service('api::wallet.wallet')
        .getWalletByOwner(user.id);

      if (!wallet || transaction.wallet?.id !== wallet.id) {
        return ctx.forbidden('You do not have access to this transaction');
      }

      return ctx.send({
        data: {
          id: transaction.id,
          documentId: transaction.documentId,
          amount: transaction.amount,
          type: transaction.type,
          status: transaction.status,
          reference_type: transaction.reference_type,
          reference_id: transaction.reference_id,
          payment_id: transaction.payment_id,
          description: transaction.description,
          metadata: transaction.metadata,
          createdAt: transaction.createdAt || transaction.created_at,
        },
      });
    } catch (error) {
      strapi.log.error('[Transaction Controller] findOne() failed:', error.message);
      return ctx.internalServerError('Failed to fetch transaction');
    }
  },
}));
