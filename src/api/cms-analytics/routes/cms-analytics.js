module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/cms-analytics',
      handler: 'cms-analytics.fetchAll',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
