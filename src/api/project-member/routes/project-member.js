module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/projects/:id/members',
      handler: 'project-member.findMembers',
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
