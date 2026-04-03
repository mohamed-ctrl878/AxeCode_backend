module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/notification-preferences/mine',
      handler: 'notification-preference.getMyPreferences',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/notification-preferences/mine',
      handler: 'notification-preference.updateMyPreferences',
      config: {
        policies: [],
        middlewares: [],
      },
    }
  ]
};
