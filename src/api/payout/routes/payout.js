'use strict';

/**
 * payout router
 */

module.exports = {
    routes: [
        {
            method: 'POST',
            path: '/payouts/request',
            handler: 'api::payout.payout.request',
            config: {
                policies: [],
                description: 'Request a financial payout from publisher wallet',
            },
        },
        // Standard Payout CRUD
        {
            method: 'GET',
            path: '/payouts',
            handler: 'api::payout.payout.find',
            config: {
                policies: [],
            }
        },
        {
            method: 'GET',
            path: '/payouts/:id',
            handler: 'api::payout.payout.findOne',
            config: {
                policies: [],
            }
        },
        {
            method: 'PUT',
            path: '/payouts/:id',
            handler: 'api::payout.payout.update',
            config: {
                policies: [],
            }
        },
        {
            method: 'DELETE',
            path: '/payouts/:id',
            handler: 'api::payout.payout.delete',
            config: {
                policies: [],
            }
        }
    ]
};
