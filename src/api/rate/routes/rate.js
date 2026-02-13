'use strict';

/**
 * rate router
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/rates/summary/:contentType/:docId',
      handler: 'rate.summary',
      config: {
        auth: false, // Publicly accessible summary
      },
    },
    // Include core routes
    {
      method: 'GET',
      path: '/rates',
      handler: 'rate.find',
    },
    {
      method: 'GET',
      path: '/rates/:id',
      handler: 'rate.findOne',
    },
    {
      method: 'POST',
      path: '/rates',
      handler: 'rate.create',
    },
    {
      method: 'PUT',
      path: '/rates/:id',
      handler: 'rate.update',
    },
    {
      method: 'DELETE',
      path: '/rates/:id',
      handler: 'rate.delete',
    },
  ]
}
