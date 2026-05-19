'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

/**
 * Valid status transitions for the task state machine.
 * Key = current status, Value = array of allowed next statuses.
 */
const STATUS_TRANSITIONS = {
  todo:        ['in_progress', 'blocked'],
  in_progress: ['in_review', 'done', 'blocked', 'todo'],
  in_review:   ['done', 'in_progress', 'blocked'],
  done:        ['todo'],       // reopen
  blocked:     ['todo', 'in_progress'],
};

module.exports = createCoreController('api::task.task', ({ strapi }) => ({
  /**
   * POST /projects/:id/tasks — Create a task.
   */
  async createTask(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId } = ctx.params;
    const data = ctx.request.body?.data || ctx.request.body;

    if (!data.title) {
      return ctx.badRequest('title is required');
    }

    // Verify project membership with write permission
    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
      populate: ['publisher'],
    });
    if (!project) return ctx.notFound('Project not found');

    const isPublisher = project.publisher?.documentId === user.documentId;
    if (!isPublisher) {
      const membership = await strapi.db.query('api::project-member.project-member').findOne({
        where: { project: project.id, users_permissions_user: user.id, is_active: true },
        populate: { project_role: true },
      });
      if (!membership?.project_role?.permissions?.write) {
        return ctx.forbidden('Write permission required to create tasks');
      }
    }

    // Auto-calculate order (append to end of column)
    const existingCount = await strapi.db.query('api::task.task').count({
      where: { project: project.id, status: data.status || 'todo' },
    });

    const task = await strapi.documents('api::task.task').create({
      data: {
        title: data.title,
        description: data.description || '',
        status: data.status || 'todo',
        priority: data.priority || 'medium',
        branch_pattern: data.branch_pattern || '',
        project: projectId,
        sprint: data.sprint || null,
        assignee: data.assignee || null,
        order: existingCount,
      },
    });

    // Notify assignee if set (fire-and-forget)
    if (data.assignee) {
      try {
        const emitter = strapi.service('api::notification.notification-emitter');
        if (emitter) {
          setImmediate(() => {
            emitter.emit({
              interactionType: 'task_assigned',
              contentType: 'project',
              docId: projectId,
              actorDocumentId: user.documentId,
              extra: { taskTitle: data.title },
            }).catch(() => {});
          });
        }
      } catch (_) { /* non-blocking */ }
    }

    return { data: task };
  },

  /**
   * GET /projects/:id/tasks — List tasks for a project (filterable by sprint, status, assignee).
   */
  async findTasks(ctx) {
    const { id: projectId } = ctx.params;
    const { sprint, status, assignee } = ctx.query;

    const filters = { project: { documentId: projectId } };
    if (sprint) filters.sprint = { documentId: sprint };
    if (status) filters.status = status;
    if (assignee) filters.assignee = { documentId: assignee };

    const tasks = await strapi.documents('api::task.task').findMany({
      filters,
      populate: ['assignee', 'assignee.users_permissions_user', 'assignee.project_role', 'sprint'],
      sort: [{ order: 'asc' }],
    });

    return { data: tasks };
  },

  /**
   * PATCH /projects/:id/tasks/:taskId — Update task fields.
   */
  async updateTask(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId, taskId } = ctx.params;
    const data = ctx.request.body?.data || ctx.request.body;

    // Verify write permission
    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
      populate: ['publisher'],
    });
    if (!project) return ctx.notFound('Project not found');

    const isPublisher = project.publisher?.documentId === user.documentId;
    if (!isPublisher) {
      const membership = await strapi.db.query('api::project-member.project-member').findOne({
        where: { project: project.id, users_permissions_user: user.id, is_active: true },
        populate: { project_role: true },
      });
      if (!membership?.project_role?.permissions?.write) {
        return ctx.forbidden('Write permission required');
      }
    }

    const updated = await strapi.documents('api::task.task').update({
      documentId: taskId,
      data,
    });

    // Notify new assignee if changed (fire-and-forget)
    if (data.assignee) {
      try {
        const emitter = strapi.service('api::notification.notification-emitter');
        if (emitter) {
          setImmediate(() => {
            emitter.emit({
              interactionType: 'task_assigned',
              contentType: 'project',
              docId: projectId,
              actorDocumentId: user.documentId,
              extra: { taskTitle: updated.title },
            }).catch(() => {});
          });
        }
      } catch (_) { /* non-blocking */ }
    }

    return { data: updated };
  },

  /**
   * PATCH /projects/:id/tasks/:taskId/transition — Status transition with state machine validation.
   * Body: { status: 'in_progress' | 'in_review' | 'done' | ... }
   */
  async transitionTask(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId, taskId } = ctx.params;
    const { status: newStatus } = ctx.request.body?.data || ctx.request.body;

    if (!newStatus) return ctx.badRequest('status is required');

    // Verify write permission
    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
      populate: ['publisher'],
    });
    if (!project) return ctx.notFound('Project not found');

    const isPublisher = project.publisher?.documentId === user.documentId;
    if (!isPublisher) {
      const membership = await strapi.db.query('api::project-member.project-member').findOne({
        where: { project: project.id, users_permissions_user: user.id, is_active: true },
        populate: { project_role: true },
      });
      if (!membership?.project_role?.permissions?.write) {
        return ctx.forbidden('Write permission required');
      }
    }

    // Load current task
    const task = await strapi.documents('api::task.task').findOne({ documentId: taskId });
    if (!task) return ctx.notFound('Task not found');

    // Validate transition
    const allowed = STATUS_TRANSITIONS[task.status] || [];
    if (!allowed.includes(newStatus)) {
      return ctx.badRequest(
        `Invalid transition: ${task.status} → ${newStatus}. Allowed: ${allowed.join(', ')}`
      );
    }

    const updated = await strapi.documents('api::task.task').update({
      documentId: taskId,
      data: { status: newStatus },
    });

    return { data: updated };
  },

  /**
   * PATCH /projects/:id/tasks/reorder — Reorder tasks within a status column.
   * Body: { tasks: [{ documentId: string, order: number }] }
   */
  async reorderTasks(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { tasks } = ctx.request.body?.data || ctx.request.body;

    if (!Array.isArray(tasks)) {
      return ctx.badRequest('tasks array is required');
    }

    for (const t of tasks) {
      await strapi.documents('api::task.task').update({
        documentId: t.documentId,
        data: { order: t.order },
      });
    }

    return { data: { message: 'Tasks reordered' } };
  },

  /**
   * DELETE /projects/:id/tasks/:taskId — Delete a task.
   */
  async deleteTask(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId, taskId } = ctx.params;

    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
      populate: ['publisher'],
    });
    if (!project) return ctx.notFound('Project not found');

    if (project.publisher?.documentId !== user.documentId) {
      return ctx.forbidden('Only project admin can delete tasks');
    }

    await strapi.documents('api::task.task').delete({ documentId: taskId });

    return { data: { message: 'Task deleted' } };
  },
}));
