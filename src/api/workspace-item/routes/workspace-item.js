module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/projects/:id/workspace',
      handler: 'workspace-item.findWorkspace',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/projects/:id/workspace',
      handler: 'workspace-item.createWorkspaceItem',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'PATCH',
      path: '/projects/:id/workspace/:itemId',
      handler: 'workspace-item.updateWorkspaceItem',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'DELETE',
      path: '/projects/:id/workspace/:itemId',
      handler: 'workspace-item.deleteWorkspaceItem',
      config: { policies: [], middlewares: [] },
    },
  ],
};
