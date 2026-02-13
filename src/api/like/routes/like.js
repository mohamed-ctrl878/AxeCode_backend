'use strict';

/**
 * like router
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/likes/toggle',
      handler: 'like.toggle',
    },
    // Core routes
    {
      method: 'GET',
      path: '/likes',
      handler: 'like.find',
    },
    {
      method: 'GET',
      path: '/likes/:id',
      handler: 'like.findOne',
    },
    {
      method: 'POST',
      path: '/likes',
      handler: 'like.create',
    },
    {
      method: 'DELETE',
      path: '/likes/:id',
      handler: 'like.delete',
    },
  ]
}
