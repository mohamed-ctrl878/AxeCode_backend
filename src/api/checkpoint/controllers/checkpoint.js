'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { hasProjectPermission } = require('../../../utils/rbac');

module.exports = createCoreController('api::checkpoint.checkpoint', ({ strapi }) => ({
  /**
   * GET /projects/:id/checkpoints — List checkpoints for a project (optionally filtered by sprint/stage).
   */
  async findCheckpoints(ctx) {
    const { id: projectId } = ctx.params;
    const { sprint: sprintId, stage } = ctx.query;

    const filters = { project: { documentId: projectId } };
    if (sprintId) filters.sprint = { documentId: sprintId };
    if (stage) filters.stage = stage;

    const checkpoints = await strapi.documents('api::checkpoint.checkpoint').findMany({
      filters,
      populate: ['tasks', 'tasks.assignee', 'tasks.assignee.users_permissions_user', 'sprint'],
      sort: [{ createdAt: 'asc' }],
    });

    return { data: checkpoints };
  },

  /**
   * POST /projects/:id/checkpoints — Create a checkpoint.
   */
  async createCheckpoint(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId } = ctx.params;
    const data = ctx.request.body?.data || ctx.request.body;

    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
    });
    if (!project) return ctx.notFound('Project not found');

    const hasPerm = await hasProjectPermission(strapi, projectId, user.id, 'write_checkpoints');
    if (!hasPerm) return ctx.forbidden('write_checkpoints permission required');

    const checkpoint = await strapi.documents('api::checkpoint.checkpoint').create({
      data: {
        name: data.name,
        stage: data.stage,
        project: projectId,
        sprint: data.sprint,
      },
      populate: ['tasks', 'sprint'],
    });

    return { data: checkpoint };
  },

  /**
   * PATCH /projects/:id/checkpoints/:checkpointId — Update a checkpoint.
   */
  async updateCheckpoint(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId, checkpointId } = ctx.params;
    const data = ctx.request.body?.data || ctx.request.body;

    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
    });
    if (!project) return ctx.notFound('Project not found');

    const hasPerm = await hasProjectPermission(strapi, projectId, user.id, 'write_checkpoints');
    if (!hasPerm) return ctx.forbidden('write_checkpoints permission required');

    const updated = await strapi.documents('api::checkpoint.checkpoint').update({
      documentId: checkpointId,
      data,
      populate: ['tasks', 'sprint'],
    });

    return { data: updated };
  },

  /**
   * DELETE /projects/:id/checkpoints/:checkpointId — Delete a checkpoint.
   */
  async deleteCheckpoint(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId, checkpointId } = ctx.params;

    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
    });
    if (!project) return ctx.notFound('Project not found');

    const hasPerm = await hasProjectPermission(strapi, projectId, user.id, 'write_checkpoints');
    if (!hasPerm) return ctx.forbidden('write_checkpoints permission required');

    await strapi.documents('api::checkpoint.checkpoint').delete({
      documentId: checkpointId,
    });

    return { data: { message: 'Checkpoint deleted' } };
  },
}));
