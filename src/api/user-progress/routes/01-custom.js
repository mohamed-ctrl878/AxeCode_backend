'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/user-progress/update',
      handler: 'api::user-progress.user-progress.updateProgress',
      config: {
        auth: false, // Testing purposes
        policies: [],
        middlewares: [],
      },
    },
  ],
};
