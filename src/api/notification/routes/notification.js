module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/notifications/mine',
      handler: 'notification.mine',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/notifications/unread-count',
      handler: 'notification.unreadCount',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PATCH',
      path: '/notifications/:id/read',
      handler: 'notification.read',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PATCH',
      path: '/notifications/read-all',
      handler: 'notification.readAll',
      config: {
        policies: [],
        middlewares: [],
      },
    }
  ]
};
