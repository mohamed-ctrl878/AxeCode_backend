'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/test/e2e-wallet',
      handler: 'test.runTest',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
