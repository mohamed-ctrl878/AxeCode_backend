module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/projects/:id/checkpoints',
      handler: 'checkpoint.findCheckpoints',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/projects/:id/checkpoints',
      handler: 'checkpoint.createCheckpoint',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'PATCH',
      path: '/projects/:id/checkpoints/:checkpointId',
      handler: 'checkpoint.updateCheckpoint',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'DELETE',
      path: '/projects/:id/checkpoints/:checkpointId',
      handler: 'checkpoint.deleteCheckpoint',
      config: { policies: [], middlewares: [] },
    },
  ],
};
