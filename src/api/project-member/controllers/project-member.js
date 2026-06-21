'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { hasProjectPermission } = require('../../../utils/rbac');

module.exports = createCoreController('api::project-member.project-member', ({ strapi }) => ({
  /**
   * GET /projects/:id/members — List project members.
   */
  async findMembers(ctx) {
    const { id: projectId } = ctx.params;

    const members = await strapi.documents('api::project-member.project-member').findMany({
      filters: { project: { documentId: projectId }, is_active: true },
      populate: ['users_permissions_user', 'project_role', 'project_role.job_title_tag'],
    });

    return { data: members };
  },

  /**
   * PATCH /projects/:id/members/:memberId/assign-role — Assign or change a member's role.
   * Body: { roleId: string }
   */
  async assignRole(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId, memberId } = ctx.params;
    const { roleId } = ctx.request.body?.data || ctx.request.body;

    if (!roleId) return ctx.badRequest('roleId is required');

    const canManage = await hasProjectPermission(strapi, projectId, user.id, 'manage_members');
    if (!canManage) return ctx.forbidden('manage_members permission required');

    // Verify the role belongs to this project
    const role = await strapi.documents('api::project-role.project-role').findOne({
      documentId: roleId,
      populate: ['project'],
    });
    if (!role || role.project?.documentId !== projectId) {
      return ctx.badRequest('Role does not belong to this project');
    }

    const updated = await strapi.documents('api::project-member.project-member').update({
      documentId: memberId,
      data: { project_role: roleId },
      populate: ['users_permissions_user', 'project_role', 'project_role.job_title_tag'],
    });

    return { data: updated };
  },

  /**
   * DELETE /projects/:id/members/:memberId — Remove a member (manage_members permission required).
   */
  async removeMember(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId, memberId } = ctx.params;

    const canManage = await hasProjectPermission(strapi, projectId, user.id, 'manage_members');
    if (!canManage) return ctx.forbidden('manage_members permission required');

    // Soft deactivate
    await strapi.documents('api::project-member.project-member').update({
      documentId: memberId,
      data: { is_active: false },
    });

    return { data: { message: 'Member removed' } };
  },
}));
