'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::project-role.project-role', ({ strapi }) => ({
  /**
   * POST /projects/:id/roles — Create a project role.
   */
  async createRole(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId } = ctx.params;
    const data = ctx.request.body?.data || ctx.request.body;

    // Verify project exists and user is admin
    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
      populate: ['publisher'],
    });

    if (!project) return ctx.notFound('Project not found');
    if (project.publisher?.documentId !== user.documentId) {
      return ctx.forbidden('Only project admin can create roles');
    }

    if (!data.job_title_tag) {
      return ctx.badRequest('job_title_tag is required — each role must be anchored to a job title tag');
    }

    const role = await strapi.documents('api::project-role.project-role').create({
      data: {
        ...data,
        project: projectId,
        permissions: data.permissions || { read: true, write: true, review: false, admin: false },
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
      populate: ['publisher'],
    });

    if (!project) return ctx.notFound('Project not found');
    if (project.publisher?.documentId !== user.documentId) {
      return ctx.forbidden('Only project admin can update roles');
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
