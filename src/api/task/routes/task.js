module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/projects/:id/tasks',
      handler: 'task.findTasks',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/projects/:id/tasks',
      handler: 'task.createTask',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'PATCH',
      path: '/projects/:id/tasks/:taskId',
      handler: 'task.updateTask',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'PATCH',
      path: '/projects/:id/tasks/:taskId/transition',
      handler: 'task.transitionTask',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'PATCH',
      path: '/projects/:id/tasks/reorder',
      handler: 'task.reorderTasks',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'DELETE',
      path: '/projects/:id/tasks/:taskId',
      handler: 'task.deleteTask',
      config: { policies: [], middlewares: [] },
    },
  ],
};
