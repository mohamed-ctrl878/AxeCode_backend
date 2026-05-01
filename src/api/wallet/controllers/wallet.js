'use strict';

/**
 * Wallet Controller
 * 
 * - Publisher: sees only their own wallet
 * - Admin: sees all wallets, can update commission_rate
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::wallet.wallet', ({ strapi }) => ({

  /**
   * GET /api/wallet/me
   * Returns the authenticated publisher's wallet (or creates one).
   */
  async me(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    try {
      const wallet = await strapi.service('api::wallet.wallet')
        .findOrCreateWallet(user.id, 'publisher');

      // Fetch the wallet with the most recent transactions and payouts
      const enrichedWallet = await strapi.db.query('api::wallet.wallet').findOne({
        where: { id: wallet.id },
        populate: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            limit: 10
          },
          payouts: {
            orderBy: { createdAt: 'desc' },
            limit: 10
          }
        }
      });

      const balance = await strapi.service('api::wallet.wallet')
        .getBalance(wallet.id);

      return ctx.send({
        data: {
          id: wallet.id,
          documentId: wallet.documentId,
          owner_type: wallet.owner_type,
          currency: wallet.currency,
          commission_rate: wallet.commission_rate,
          is_active: wallet.is_active,
          ...balance,
          transactions: enrichedWallet.transactions || [],
          payouts: enrichedWallet.payouts || [],
          createdAt: wallet.createdAt || wallet.created_at,
        },
      });
    } catch (error) {
      strapi.log.error('[Wallet Controller] me() failed:', error.message);
      return ctx.internalServerError('Failed to fetch wallet');
    }
  },

  /**
   * GET /api/wallet/platform
   * Publisher (Admin) only: returns the platform's commission wallet.
   */
  async platform(ctx) {
    try {
      const platformWallet = await strapi.service('api::wallet.wallet').getPlatformWallet();

      const enrichedWallet = await strapi.db.query('api::wallet.wallet').findOne({
        where: { id: platformWallet.id },
        populate: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            limit: 20
          },
        }
      });

      const balance = await strapi.service('api::wallet.wallet').getBalance(platformWallet.id);

      return ctx.send({
        data: {
          id: platformWallet.id,
          documentId: platformWallet.documentId,
          owner_type: 'platform',
          currency: platformWallet.currency,
          is_active: platformWallet.is_active,
          ...balance,
          transactions: enrichedWallet.transactions || [],
          createdAt: platformWallet.createdAt || platformWallet.created_at,
        },
      });
    } catch (error) {
      strapi.log.error('[Wallet Controller] platform() failed:', error.message);
      return ctx.internalServerError('Failed to fetch platform wallet');
    }
  },

  /**
   * GET /api/wallets
   * Admin-only: lists all wallets with pagination.
   */
  async find(ctx) {
    const { page = 1, pageSize = 25, owner_type, is_active, currency } = ctx.query;

    const where = {};
    if (owner_type) where.owner_type = owner_type;
    if (is_active !== undefined) where.is_active = is_active === 'true';
    if (currency) where.currency = currency;

    try {
      const [wallets, count] = await Promise.all([
        strapi.db.query('api::wallet.wallet').findMany({
          where,
          orderBy: { createdAt: 'desc' },
          offset: (parseInt(page) - 1) * parseInt(pageSize),
          limit: parseInt(pageSize),
          populate: ['owner'],
        }),
        strapi.db.query('api::wallet.wallet').count({ where }),
      ]);

      return ctx.send({
        data: wallets.map(w => ({
          id: w.id,
          documentId: w.documentId,
          owner_type: w.owner_type,
          balance: w.balance,
          pending_balance: w.pending_balance,
          currency: w.currency,
          commission_rate: w.commission_rate,
          is_active: w.is_active,
          owner: w.owner ? { id: w.owner.id, username: w.owner.username, email: w.owner.email } : null,
          createdAt: w.createdAt || w.created_at,
        })),
        meta: {
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            pageCount: Math.ceil(count / parseInt(pageSize)),
            total: count,
          },
        },
      });
    } catch (error) {
      strapi.log.error('[Wallet Controller] find() failed:', error.message);
      return ctx.internalServerError('Failed to fetch wallets');
    }
  },

  /**
   * GET /api/wallets/:id
   * Admin-only: get a specific wallet with its balance info.
   */
  async findOne(ctx) {
    const { id } = ctx.params;

    try {
      const wallet = await strapi.db.query('api::wallet.wallet').findOne({
        where: { id },
        populate: ['owner'],
      });

      if (!wallet) return ctx.notFound('Wallet not found');

      const balance = await strapi.service('api::wallet.wallet').getBalance(wallet.id);

      return ctx.send({
        data: {
          id: wallet.id,
          documentId: wallet.documentId,
          owner_type: wallet.owner_type,
          currency: wallet.currency,
          commission_rate: wallet.commission_rate,
          is_active: wallet.is_active,
          ...balance,
          owner: wallet.owner ? { id: wallet.owner.id, username: wallet.owner.username, email: wallet.owner.email } : null,
          createdAt: wallet.createdAt || wallet.created_at,
        },
      });
    } catch (error) {
      strapi.log.error('[Wallet Controller] findOne() failed:', error.message);
      return ctx.internalServerError('Failed to fetch wallet');
    }
  },

  /**
   * PUT /api/wallets/:id/commission
   * Admin-only: update a publisher's commission rate.
   */
  async updateCommission(ctx) {
    const { id } = ctx.params;
    const { commission_rate } = ctx.request.body;

    if (commission_rate === undefined || commission_rate === null) {
      return ctx.badRequest('commission_rate is required');
    }

    const rate = parseFloat(commission_rate);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      return ctx.badRequest('commission_rate must be a number between 0 and 1');
    }

    try {
      await strapi.service('api::wallet.wallet').updateCommissionRate(id, rate);

      return ctx.send({
        data: { id: parseInt(id), commission_rate: rate },
        message: `Commission rate updated to ${(rate * 100).toFixed(1)}%`,
      });
    } catch (error) {
      strapi.log.error('[Wallet Controller] updateCommission() failed:', error.message);
      return ctx.internalServerError('Failed to update commission rate');
    }
  },
}));
