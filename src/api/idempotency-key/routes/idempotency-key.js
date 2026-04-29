'use strict';

/**
 * Idempotency Key Routes
 * 
 * Internal only — no public API endpoints.
 * The idempotency service is called by the payment webhook controller.
 * 
 * Only admin can view keys for debugging purposes.
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/idempotency-keys',
      handler: 'api::idempotency-key.idempotency-key.find',
      config: {
        policies: [],
        description: 'List idempotency keys (Admin debugging only)',
      },
    },
  ],
};
