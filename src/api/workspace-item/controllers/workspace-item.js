'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::workspace-item.workspace-item', ({ strapi }) => ({
  /**
   * Helper: verify user membership and return member record.
   */
  async getProjectMember(projectId, userId) {
    // Check if user is the publisher of the project
    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
      populate: ['publisher'],
    });

    if (!project) return null;

    // Find active membership
    const memberships = await strapi.documents('api::project-member.project-member').findMany({
      filters: {
        project: { documentId: projectId },
        users_permissions_user: { id: userId },
        is_active: true,
      },
    });

    if (memberships && memberships.length > 0) {
      return { member: memberships[0], isPublisher: project.publisher?.id === userId };
    }

    if (project.publisher?.id === userId) {
      // Publisher might not have a formal membership record, let's look one up or mock it
      // Let's look for a membership anyway
      const allMembers = await strapi.documents('api::project-member.project-member').findMany({
        filters: {
          project: { documentId: projectId },
          users_permissions_user: { id: userId }
        }
      });
      if (allMembers && allMembers.length > 0) {
        return { member: allMembers[0], isPublisher: true };
      }
    }

    return null;
  },

  /**
   * GET /projects/:id/workspace — Fetch all workspace items for the current member.
   */
  async findWorkspace(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId } = ctx.params;
    const memberContext = await this.getProjectMember(projectId, user.id);
    if (!memberContext) return ctx.forbidden('You are not a member of this project');

    const items = await strapi.documents('api::workspace-item.workspace-item').findMany({
      filters: {
        project: { documentId: projectId },
        project_member: { id: memberContext.member.id },
      },
      populate: ['linked_task'],
    });

    return { data: items };
  },

  /**
   * POST /projects/:id/workspace — Create a new workspace draft.
   */
  async createWorkspaceItem(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId } = ctx.params;
    const data = ctx.request.body?.data || ctx.request.body;

    if (!data.type || !data.title) {
      return ctx.badRequest('type and title are required');
    }

    const memberContext = await this.getProjectMember(projectId, user.id);
    if (!memberContext) return ctx.forbidden('You are not a member of this project');

    const item = await strapi.documents('api::workspace-item.workspace-item').create({
      data: {
        project: projectId,
        project_member: memberContext.member.documentId,
        type: data.type,
        title: data.title,
        content: data.content || (data.type === 'document' ? [] : { nodes: [], edges: [] }),
        status: 'draft',
        linked_task: data.linked_task || null,
      },
      populate: ['linked_task'],
    });

    return { data: item };
  },

  /**
   * PATCH /projects/:id/workspace/:itemId — Update a workspace draft.
   */
  async updateWorkspaceItem(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId, itemId } = ctx.params;
    const data = ctx.request.body?.data || ctx.request.body;

    const memberContext = await this.getProjectMember(projectId, user.id);
    if (!memberContext) return ctx.forbidden('You are not a member of this project');

    // Load item and check ownership
    const item = await strapi.documents('api::workspace-item.workspace-item').findOne({
      documentId: itemId,
      populate: ['project_member'],
    });

    if (!item) return ctx.notFound('Workspace item not found');

    if (item.project_member?.id !== memberContext.member.id && !memberContext.isPublisher) {
      return ctx.forbidden('You do not own this workspace item');
    }

    const updated = await strapi.documents('api::workspace-item.workspace-item').update({
      documentId: itemId,
      data: {
        title: data.title !== undefined ? data.title : item.title,
        content: data.content !== undefined ? data.content : item.content,
        linked_task: data.linked_task !== undefined ? data.linked_task : item.linked_task,
        status: data.status !== undefined ? data.status : item.status,
      },
      populate: ['linked_task'],
    });

    return { data: updated };
  },

  /**
   * DELETE /projects/:id/workspace/:itemId — Delete a workspace draft.
   */
  async deleteWorkspaceItem(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId, itemId } = ctx.params;

    const memberContext = await this.getProjectMember(projectId, user.id);
    if (!memberContext) return ctx.forbidden('You are not a member of this project');

    // Load item and check ownership
    const item = await strapi.documents('api::workspace-item.workspace-item').findOne({
      documentId: itemId,
      populate: ['project_member'],
    });

    if (!item) return ctx.notFound('Workspace item not found');

    if (item.project_member?.id !== memberContext.member.id && !memberContext.isPublisher) {
      return ctx.forbidden('You do not own this workspace item');
    }

    await strapi.documents('api::workspace-item.workspace-item').delete({
      documentId: itemId,
    });

    return { data: { success: true } };
  },
}));
