module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/job-title-tags',
      handler: 'job-title-tag.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
