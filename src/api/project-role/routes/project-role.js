module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/projects/:id/roles',
      handler: 'project-role.findRoles',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/projects/:id/roles',
      handler: 'project-role.createRole',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'PATCH',
      path: '/projects/:id/roles/:roleId',
      handler: 'project-role.updateRole',
      config: { policies: [], middlewares: [] },
    },
  ],
};
