'use strict';

/**
 * Payment Routes
 * 
 * Special route for Paymob webhook (Public access).
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/payments/initiate',
      handler: 'api::payment.payment.initiate',
      config: {
        policies: [],
        description: 'Initiates a payment checkout for an event',
      },
    },
    {
      method: 'POST',
      path: '/payments/webhook',
      handler: 'api::payment.payment.webhook',
      config: {
        auth: false, // Important: Allow Paymob to hit this without JWT
        policies: [],
        description: 'Receives webhook notifications from Paymob',
      },
    },
    // Standard CRUD routes
    {
      method: 'GET',
      path: '/payments',
      handler: 'api::payment.payment.find',
      config: {
        policies: [],
      }
    },
    {
      method: 'GET',
      path: '/payments/:id',
      handler: 'api::payment.payment.findOne',
      config: {
        policies: [],
      }
    }
  ],
};
