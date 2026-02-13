'use strict';

/**
 * scan-ticket routes
 */
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/scan-ticket/:documentId',
      handler: 'scan-ticket.scanTicket',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          // This requires authentication - only authenticated users can scan
          // Role-based authorization is handled in the service layer
        }
      }
    }
  ]
};
