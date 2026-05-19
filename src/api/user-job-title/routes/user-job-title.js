module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/users/me/job-titles',
      handler: 'user-job-title.getMyJobTitles',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/users/me/job-titles',
      handler: 'user-job-title.addMyJobTitle',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/users/me/job-titles/:tagId',
      handler: 'user-job-title.removeMyJobTitle',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
