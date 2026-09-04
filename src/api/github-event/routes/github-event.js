module.exports = {
  routes: [
    // GitHub webhook endpoint — called by GitHub, public (verified by HMAC)
    {
      method: 'POST',
      path: '/github/webhook',
      handler: 'github-event.ingest',
      config: {
        policies: [],
        middlewares: [],
        auth: false, // Public — GitHub cannot authenticate via JWT
      },
    },
    // List events for a project — authenticated
    {
      method: 'GET',
      path: '/projects/:id/github-events',
      handler: 'github-event.findByProject',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
