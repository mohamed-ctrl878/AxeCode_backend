module.exports = {
  routes: [
    // Developer applies to a role
    {
      method: 'POST',
      path: '/projects/:id/apply',
      handler: 'project-application.apply',
      config: { policies: [], middlewares: [] },
    },
    // Publisher invites a user
    {
      method: 'POST',
      path: '/projects/:id/invite',
      handler: 'project-application.invite',
      config: { policies: [], middlewares: [] },
    },
    // Respond to application/invitation (accept/reject)
    {
      method: 'PATCH',
      path: '/project-applications/:applicationId/respond',
      handler: 'project-application.respond',
      config: { policies: [], middlewares: [] },
    },
    // List applications for a project (admin)
    {
      method: 'GET',
      path: '/projects/:id/applications',
      handler: 'project-application.findByProject',
      config: { policies: [], middlewares: [] },
    },
    // List current user's applications
    {
      method: 'GET',
      path: '/users/me/applications',
      handler: 'project-application.myApplications',
      config: { policies: [], middlewares: [] },
    },
  ],
};
