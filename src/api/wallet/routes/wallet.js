'use strict';

/**
 * Wallet Routes
 * 
 * Custom routes with role-based access:
 * - /api/wallet/me — Authenticated users (publishers)
 * - /api/wallet/platform — Publisher role only
 * - /api/wallets — Publisher role only
 * - /api/wallets/:id — Publisher role only
 * - /api/wallets/:id/commission — Publisher role only
 */

module.exports = {
  routes: [
    // --- Authenticated User Routes ---
    {
      method: 'GET',
      path: '/wallet/me',
      handler: 'wallet.me',
      config: {
        policies: [],
        description: 'Get the authenticated user\'s wallet',
      },
    },

    // --- Publisher (Admin) Only Routes ---
    {
      method: 'GET',
      path: '/wallet/platform',
      handler: 'wallet.platform',
      config: {
        policies: ['api::wallet.is-publisher'],
        description: 'Get the platform wallet (Publisher/Admin only)',
      },
    },
    {
      method: 'GET',
      path: '/wallets',
      handler: 'wallet.find',
      config: {
        policies: ['api::wallet.is-publisher'],
        description: 'List all wallets (Publisher/Admin only)',
      },
    },
    {
      method: 'GET',
      path: '/wallets/:id',
      handler: 'wallet.findOne',
      config: {
        policies: ['api::wallet.is-publisher'],
        description: 'Get a specific wallet (Publisher/Admin only)',
      },
    },
    {
      method: 'PUT',
      path: '/wallets/:id/commission',
      handler: 'wallet.updateCommission',
      config: {
        policies: ['api::wallet.is-publisher'],
        description: 'Update commission rate (Publisher/Admin only)',
      },
    },
  ],
};
