'use strict';

/**
 * Transaction Routes (Read-Only)
 * 
 * No POST/PUT/DELETE — transactions are created only through internal services.
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/transactions',
      handler: 'transaction.find',
      config: {
        policies: [],
        description: 'List transactions for the authenticated user\'s wallet',
      },
    },
    {
      method: 'GET',
      path: '/transactions/summary',
      handler: 'transaction.summary',
      config: {
        policies: [],
        description: 'Get wallet summary with balance calculations',
      },
    },
    {
      method: 'GET',
      path: '/transactions/:id',
      handler: 'transaction.findOne',
      config: {
        policies: [],
        description: 'Get a specific transaction (ownership enforced)',
      },
    },
  ],
};
