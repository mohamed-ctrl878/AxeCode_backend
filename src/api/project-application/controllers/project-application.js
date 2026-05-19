'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::project-application.project-application', ({ strapi }) => ({
  /**
   * POST /projects/:id/apply — Developer applies to an open role.
   * Body: { project_role_id: string, message?: string }
   * Flow: type=apply, status=pending → awaits publisher acceptance.
   */
  async apply(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId } = ctx.params;
    const { project_role_id, message } = ctx.request.body?.data || ctx.request.body;

    if (!project_role_id) {
      return ctx.badRequest('project_role_id is required');
    }

    // Verify role exists, belongs to project, and is open
    const role = await strapi.documents('api::project-role.project-role').findOne({
      documentId: project_role_id,
      populate: ['project'],
    });

    if (!role || role.project?.documentId !== projectId) {
      return ctx.notFound('Role not found in this project');
    }

    if (!role.is_open) {
      return ctx.badRequest('This role is no longer accepting applications');
    }

    // Check for duplicate pending application
    const existing = await strapi.db.query('api::project-application.project-application').findOne({
      where: {
        user: user.id,
        project_role: role.id,
        status: 'pending',
      },
    });

    if (existing) {
      return ctx.badRequest('You already have a pending application for this role');
    }

    // Check if user is already a member
    const isMember = await strapi.db.query('api::project-member.project-member').findOne({
      where: {
        project: { documentId: projectId },
        users_permissions_user: user.id,
        is_active: true,
      },
    });

    if (isMember) {
      return ctx.badRequest('You are already a member of this project');
    }

    const application = await strapi.documents('api::project-application.project-application').create({
      data: {
        type: 'apply',
        status: 'pending',
        user: user.documentId,
        project_role: project_role_id,
        project: projectId,
        initiated_by: user.documentId,
        message: message || '',
      },
    });

    // Fire notification to publisher (fire-and-forget)
    try {
      const project = await strapi.documents('api::project.project').findOne({
        documentId: projectId,
        populate: ['publisher'],
      });
      if (project?.publisher) {
        const emitter = strapi.service('api::notification.notification-emitter');
        if (emitter) {
          setImmediate(() => {
            emitter.emit({
              interactionType: 'project_apply',
              contentType: 'project',
              docId: projectId,
              actorDocumentId: user.documentId,
              extra: { roleLabel: role.custom_label },
            }).catch(() => {});
          });
        }
      }
    } catch (_) { /* non-blocking */ }

    return { data: application };
  },

  /**
   * POST /projects/:id/invite — Publisher invites a user to a role.
   * Body: { user_id: string, project_role_id: string, message?: string }
   * Flow: type=invite, status=pending → awaits developer acceptance.
   */
  async invite(ctx) {
    const publisher = ctx.state.user;
    if (!publisher) return ctx.unauthorized('Authentication required');

    const { id: projectId } = ctx.params;
    const { user_id, project_role_id, message } = ctx.request.body?.data || ctx.request.body;

    if (!user_id || !project_role_id) {
      return ctx.badRequest('user_id and project_role_id are required');
    }

    // Verify publisher is admin
    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
      populate: ['publisher'],
    });

    if (!project) return ctx.notFound('Project not found');
    if (project.publisher?.documentId !== publisher.documentId) {
      return ctx.forbidden('Only project admin can send invitations');
    }

    // Check for duplicate pending invitation
    const existing = await strapi.db.query('api::project-application.project-application').findOne({
      where: {
        user: { documentId: user_id },
        project_role: { documentId: project_role_id },
        status: 'pending',
        type: 'invite',
      },
    });

    if (existing) {
      return ctx.badRequest('An invitation is already pending for this user and role');
    }

    const application = await strapi.documents('api::project-application.project-application').create({
      data: {
        type: 'invite',
        status: 'pending',
        user: user_id,
        project_role: project_role_id,
        project: projectId,
        initiated_by: publisher.documentId,
        message: message || '',
      },
    });

    // Fire notification to invited user (fire-and-forget)
    try {
      const emitter = strapi.service('api::notification.notification-emitter');
      if (emitter) {
        setImmediate(() => {
          emitter.emit({
            interactionType: 'project_invite',
            contentType: 'project',
            docId: projectId,
            actorDocumentId: publisher.documentId,
            extra: { targetUserDocId: user_id },
          }).catch(() => {});
        });
      }
    } catch (_) { /* non-blocking */ }

    return { data: application };
  },

  /**
   * PATCH /project-applications/:applicationId/respond
   * Body: { decision: 'accepted' | 'rejected' }
   * 
   * For apply: publisher responds.
   * For invite: developer responds.
   * On acceptance → auto-create project_member.
   */
  async respond(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { applicationId } = ctx.params;
    const { decision } = ctx.request.body?.data || ctx.request.body;

    if (!decision || !['accepted', 'rejected'].includes(decision)) {
      return ctx.badRequest('decision must be "accepted" or "rejected"');
    }

    const application = await strapi.documents('api::project-application.project-application').findOne({
      documentId: applicationId,
      populate: ['user', 'project', 'project_role', 'project.publisher', 'initiated_by'],
    });

    if (!application) return ctx.notFound('Application not found');
    if (application.status !== 'pending') {
      return ctx.badRequest('This application has already been processed');
    }

    // Authorization: who can respond?
    if (application.type === 'apply') {
      // Publisher responds to developer's application
      if (application.project?.publisher?.documentId !== user.documentId) {
        return ctx.forbidden('Only the project publisher can respond to applications');
      }
    } else if (application.type === 'invite') {
      // Developer responds to publisher's invitation
      if (application.user?.documentId !== user.documentId) {
        return ctx.forbidden('Only the invited user can respond to this invitation');
      }
    }

    // Update status
    await strapi.documents('api::project-application.project-application').update({
      documentId: applicationId,
      data: { status: decision },
    });

    // On acceptance → create project_member
    if (decision === 'accepted') {
      try {
        await strapi.documents('api::project-member.project-member').create({
          data: {
            project: application.project.documentId,
            users_permissions_user: application.user.documentId,
            project_role: application.project_role.documentId,
            github_username: '',
            is_active: true,
          },
        });
      } catch (err) {
        strapi.log.error('[ProjectApplication] Failed to create member on acceptance:', err.message);
      }

      // Notify acceptance
      try {
        const emitter = strapi.service('api::notification.notification-emitter');
        if (emitter) {
          setImmediate(() => {
            emitter.emit({
              interactionType: 'project_accepted',
              contentType: 'project',
              docId: application.project.documentId,
              actorDocumentId: user.documentId,
              extra: { applicationType: application.type },
            }).catch(() => {});
          });
        }
      } catch (_) { /* non-blocking */ }
    }

    return { data: { message: `Application ${decision}` } };
  },

  /**
   * GET /projects/:id/applications — List applications for a project (admin).
   */
  async findByProject(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId } = ctx.params;
    const { status } = ctx.query;

    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
      populate: ['publisher'],
    });

    if (!project) return ctx.notFound('Project not found');
    if (project.publisher?.documentId !== user.documentId) {
      return ctx.forbidden('Only project admin can view applications');
    }

    const filters = { project: { documentId: projectId } };
    if (status) filters.status = status;

    const applications = await strapi.documents('api::project-application.project-application').findMany({
      filters,
      populate: ['user', 'project_role', 'project_role.job_title_tag', 'initiated_by'],
      sort: [{ createdAt: 'desc' }],
    });

    return { data: applications };
  },

  /**
   * GET /users/me/applications — List current user's applications and invitations.
   */
  async myApplications(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const applications = await strapi.documents('api::project-application.project-application').findMany({
      filters: { user: { documentId: user.documentId } },
      populate: ['project', 'project_role', 'project_role.job_title_tag'],
      sort: [{ createdAt: 'desc' }],
    });

    return { data: applications };
  },
}));
