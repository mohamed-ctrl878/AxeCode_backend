'use strict';

/**
 * require-project-permission middleware
 * 
 * Extracts projectId from request params, looks up user's membership,
 * and verifies the required permission scope from project_role.permissions JSONB.
 * 
 * Usage in route config:
 *   middlewares: [{ name: 'global::require-project-permission', config: { scope: 'write' } }]
 */
module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    const scope = config?.scope || 'read';
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('Authentication required');
    }

    // Extract projectId from params (supports :id, :projectId)
    const projectId = ctx.params.id || ctx.params.projectId;
    if (!projectId) {
      return ctx.badRequest('Project ID is required');
    }

    // Look up the project
    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
      populate: ['publisher'],
    });

    if (!project) {
      return ctx.notFound('Project not found');
    }

    // Publisher always has full admin access
    if (project.publisher?.documentId === user.documentId) {
      ctx.state.projectPermission = { read: true, write: true, review: true, admin: true };
      ctx.state.project = project;
      return next();
    }

    // Look up membership
    const membership = await strapi.db.query('api::project-member.project-member').findOne({
      where: {
        project: project.id,
        users_permissions_user: user.id,
        is_active: true,
      },
      populate: { project_role: true },
    });

    if (!membership) {
      return ctx.forbidden('You are not a member of this project');
    }

    const permissions = membership.project_role?.permissions || {};
    ctx.state.projectPermission = permissions;
    ctx.state.project = project;
    ctx.state.projectMembership = membership;

    // Check required scope
    if (!permissions[scope]) {
      return ctx.forbidden(`You do not have '${scope}' permission on this project`);
    }

    return next();
  };
};
