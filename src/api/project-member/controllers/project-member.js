'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

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
   * DELETE /projects/:id/members/:memberId — Remove a member (admin only).
   */
  async removeMember(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId, memberId } = ctx.params;

    // Verify admin
    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
      populate: ['publisher'],
    });

    if (!project) return ctx.notFound('Project not found');
    if (project.publisher?.documentId !== user.documentId) {
      return ctx.forbidden('Only project admin can remove members');
    }

    // Soft deactivate
    await strapi.documents('api::project-member.project-member').update({
      documentId: memberId,
      data: { is_active: false },
    });

    return { data: { message: 'Member removed' } };
  },
}));
