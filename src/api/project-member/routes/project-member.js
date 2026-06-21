module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/projects/:id/members',
      handler: 'project-member.findMembers',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'PATCH',
      path: '/projects/:id/members/:memberId/assign-role',
      handler: 'project-member.assignRole',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'DELETE',
      path: '/projects/:id/members/:memberId',
      handler: 'project-member.removeMember',
      config: { policies: [], middlewares: [] },
    },
  ],
};
