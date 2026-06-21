'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { hasProjectPermission } = require('../../../utils/rbac');

module.exports = createCoreController('api::project-role.project-role', ({ strapi }) => ({
  /**
   * POST /projects/:id/roles — Create a project role.
   */
  async createRole(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId } = ctx.params;
    const data = ctx.request.body?.data || ctx.request.body;

    // Verify project exists and user has permission
    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
    });
    if (!project) return ctx.notFound('Project not found');

    const canManage = await hasProjectPermission(strapi, projectId, user.id, 'manage_members');
    if (!canManage) {
      return ctx.forbidden('You do not have permission to manage roles');
    }

    if (!data.job_title_tag) {
      return ctx.badRequest('job_title_tag is required — each role must be anchored to a job title tag');
    }

    const role = await strapi.documents('api::project-role.project-role').create({
      data: {
        ...data,
        project: projectId,
        permissions: data.permissions || { read: true, write_tasks: false, write_sprints: false, write_checkpoints: false, manage_members: false, admin: false },
      },
    });

    return { data: role };
  },

  /**
   * PATCH /projects/:id/roles/:roleId — Update role definition.
   */
  async updateRole(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId, roleId } = ctx.params;
    const data = ctx.request.body?.data || ctx.request.body;

    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
    });
    if (!project) return ctx.notFound('Project not found');

    const canManage = await hasProjectPermission(strapi, projectId, user.id, 'manage_members');
    if (!canManage) {
      return ctx.forbidden('You do not have permission to update roles');
    }

    const updated = await strapi.documents('api::project-role.project-role').update({
      documentId: roleId,
      data,
    });

    return { data: updated };
  },

  /**
   * GET /projects/:id/roles — List all roles for a project.
   */
  async findRoles(ctx) {
    const { id: projectId } = ctx.params;

    const roles = await strapi.documents('api::project-role.project-role').findMany({
      filters: { project: { documentId: projectId } },
      populate: ['job_title_tag'],
    });

    return { data: roles };
  },
}));
