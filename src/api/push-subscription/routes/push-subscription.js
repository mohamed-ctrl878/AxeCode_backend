module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/push-subscriptions/subscribe',
      handler: 'push-subscription.subscribe',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST', // POST is safer to safely pass endpoint in body
      path: '/push-subscriptions/unsubscribe',
      handler: 'push-subscription.unsubscribe',
      config: {
        policies: [],
        middlewares: [],
      },
    }
  ]
};
