'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::sprint.sprint', ({ strapi }) => ({
  /**
   * POST /projects/:id/sprints — Create a sprint.
   */
  async createSprint(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId } = ctx.params;
    const data = ctx.request.body?.data || ctx.request.body;

    // Verify admin
    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
      populate: ['publisher'],
    });
    if (!project) return ctx.notFound('Project not found');
    if (project.publisher?.documentId !== user.documentId) {
      return ctx.forbidden('Only project admin can create sprints');
    }

    // Auto-calculate sprint number
    const existingSprints = await strapi.db.query('api::sprint.sprint').count({
      where: { project: project.id },
    });

    const sprint = await strapi.documents('api::sprint.sprint').create({
      data: {
        ...data,
        project: projectId,
        number: existingSprints + 1,
        status: data.status || 'planned',
      },
    });

    return { data: sprint };
  },

  /**
   * PATCH /projects/:id/sprints/:sprintId — Update sprint.
   */
  async updateSprint(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId, sprintId } = ctx.params;
    const data = ctx.request.body?.data || ctx.request.body;

    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
      populate: ['publisher'],
    });
    if (!project) return ctx.notFound('Project not found');
    if (project.publisher?.documentId !== user.documentId) {
      return ctx.forbidden('Only project admin can update sprints');
    }

    const updated = await strapi.documents('api::sprint.sprint').update({
      documentId: sprintId,
      data,
    });

    return { data: updated };
  },

  /**
   * GET /projects/:id/sprints — List sprints for a project.
   */
  async findSprints(ctx) {
    const { id: projectId } = ctx.params;

    const sprints = await strapi.documents('api::sprint.sprint').findMany({
      filters: { project: { documentId: projectId } },
      sort: [{ number: 'asc' }],
    });

    return { data: sprints };
  },

  /**
   * POST /projects/:id/sprints/:sprintId/start — Activate a sprint.
   */
  async startSprint(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId, sprintId } = ctx.params;

    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
      populate: ['publisher'],
    });
    if (!project) return ctx.notFound('Project not found');
    if (project.publisher?.documentId !== user.documentId) {
      return ctx.forbidden('Only project admin can start sprints');
    }

    // Deactivate any currently active sprint
    const activeSprints = await strapi.db.query('api::sprint.sprint').findMany({
      where: { project: project.id, status: 'active' },
    });
    for (const s of activeSprints) {
      await strapi.db.query('api::sprint.sprint').update({
        where: { id: s.id },
        data: { status: 'completed' },
      });
    }

    const updated = await strapi.documents('api::sprint.sprint').update({
      documentId: sprintId,
      data: {
        status: 'active',
        start_date: new Date().toISOString().split('T')[0],
      },
    });

    // Fire sprint_started notification to all members (fire-and-forget)
    try {
      const emitter = strapi.service('api::notification.notification-emitter');
      if (emitter) {
        setImmediate(() => {
          emitter.emit({
            interactionType: 'sprint_started',
            contentType: 'project',
            docId: projectId,
            actorDocumentId: user.documentId,
            extra: { sprintGoal: updated.goal || '' },
          }).catch(() => {});
        });
      }
    } catch (_) { /* non-blocking */ }

    return { data: updated };
  },
}));
