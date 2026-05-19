module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/projects/:id/sprints',
      handler: 'sprint.findSprints',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/projects/:id/sprints',
      handler: 'sprint.createSprint',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'PATCH',
      path: '/projects/:id/sprints/:sprintId',
      handler: 'sprint.updateSprint',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/projects/:id/sprints/:sprintId/start',
      handler: 'sprint.startSprint',
      config: { policies: [], middlewares: [] },
    },
  ],
};
