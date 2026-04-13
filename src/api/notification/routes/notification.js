module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/notifications/mine',
      handler: 'api::notification.notification.mine',
      config: {
        // In Strapi 5, config.auth should be an object or omitted. 
        // Setting it to an empty object enables default authentication.
        auth: {},
      },
    },
    {
      method: 'GET',
      path: '/notifications/unread-count',
      handler: 'api::notification.notification.unreadCount',
      config: {
        auth: {},
      },
    },
    {
      method: 'PATCH',
      path: '/notifications/:id/read',
      handler: 'api::notification.notification.read',
      config: {
        auth: {},
      },
    },
    {
      method: 'PATCH',
      path: '/notifications/read-all',
      handler: 'api::notification.notification.readAll',
      config: {
        auth: {},
      },
    },
    {
      method: 'GET',
      path: '/notifications',
      handler: 'api::notification.notification.find',
      config: {
        auth: {},
      },
    },
    {
      method: 'GET',
      path: '/notifications/:id',
      handler: 'api::notification.notification.findOne',
      config: {
        auth: {},
      },
    }
  ]
};
