const { factories } = require('@strapi/strapi');

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/notifications/mine',
      handler: 'api::notification.notification.mine',
      config: {
        auth: true,
      },
    },
    {
      method: 'GET',
      path: '/notifications/unread-count',
      handler: 'api::notification.notification.unreadCount',
      config: {
        auth: true,
      },
    },
    {
      method: 'PATCH',
      path: '/notifications/:id/read',
      handler: 'api::notification.notification.read',
      config: {
        auth: true,
      },
    },
    {
      method: 'PATCH',
      path: '/notifications/read-all',
      handler: 'api::notification.notification.readAll',
      config: {
        auth: true,
      },
    },
    // Core routes (if needed, though usually they are in a separate core router file)
    {
      method: 'GET',
      path: '/notifications',
      handler: 'api::notification.notification.find',
    },
    {
      method: 'GET',
      path: '/notifications/:id',
      handler: 'api::notification.notification.findOne',
    }
  ]
};
