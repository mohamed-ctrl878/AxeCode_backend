'use strict';

/**
 * Wallet Routes
 * 
 * Custom routes with role-based access:
 * - /api/wallet/me — Authenticated users (publishers)
 * - /api/wallets — Admin only
 * - /api/wallets/:id — Admin only
 * - /api/wallets/:id/commission — Admin only
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/wallet/me',
      handler: 'wallet.me',
      config: {
        policies: [],
        description: 'Get the authenticated user\'s wallet',
      },
    },
    {
      method: 'GET',
      path: '/wallets',
      handler: 'wallet.find',
      config: {
        policies: [],
        description: 'List all wallets (Admin only)',
      },
    },
    {
      method: 'GET',
      path: '/wallets/:id',
      handler: 'wallet.findOne',
      config: {
        policies: [],
        description: 'Get a specific wallet (Admin only)',
      },
    },
    {
      method: 'PUT',
      path: '/wallets/:id/commission',
      handler: 'wallet.updateCommission',
      config: {
        policies: [],
        description: 'Update commission rate for a wallet (Admin only)',
      },
    },
  ],
};
