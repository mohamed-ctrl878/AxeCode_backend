'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { hasProjectPermission } = require('../../../utils/rbac');

module.exports = createCoreController('api::review-request.review-request', ({ strapi }) => ({
  /**
   * Helper: verify user membership and return member record.
   */
  async getProjectMember(projectId, userId) {
    const project = await strapi.documents('api::project.project').findOne({
      documentId: projectId,
      populate: ['publisher'],
    });

    if (!project) return null;

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
   * GET /projects/:id/review-requests — List review requests in the project.
   */
  async findReviewRequests(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId } = ctx.params;
    const memberContext = await this.getProjectMember(projectId, user.id);
    if (!memberContext) return ctx.forbidden('You are not a member of this project');

    const requests = await strapi.documents('api::review-request.review-request').findMany({
      filters: {
        project: { documentId: projectId },
      },
      populate: [
        'task',
        'workspace_item',
        'requester',
        'requester.users_permissions_user',
        'reviewer',
        'reviewer.users_permissions_user',
      ],
      sort: [{ createdAt: 'desc' }],
    });

    return { data: requests };
  },

  /**
   * POST /projects/:id/review-requests — Create a review request.
   */
  async createReviewRequest(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId } = ctx.params;
    const data = ctx.request.body?.data || ctx.request.body;

    if (!data.task || !data.reviewer) {
      return ctx.badRequest('task and reviewer are required');
    }

    if (!data.workspace_item && !data.external_link) {
      return ctx.badRequest('Either a workspace draft or an external commit link is required');
    }

    const memberContext = await this.getProjectMember(projectId, user.id);
    if (!memberContext) return ctx.forbidden('You are not a member of this project');

    // Create review request
    const reviewRequest = await strapi.documents('api::review-request.review-request').create({
      data: {
        project: projectId,
        task: data.task,
        workspace_item: data.workspace_item || null,
        external_link: data.external_link || '',
        requester: memberContext.member.documentId,
        reviewer: data.reviewer,
        status: 'pending',
        message: data.message || '',
      },
    });

    // Automatically transition the task status to in_review
    await strapi.documents('api::task.task').update({
      documentId: data.task,
      data: { status: 'in_review' },
    });

    // Automatically update the workspace item's status to submitted and link it to the task
    if (data.workspace_item) {
      await strapi.documents('api::workspace-item.workspace-item').update({
        documentId: data.workspace_item,
        data: {
          status: 'submitted',
          linked_task: data.task,
        },
      });
    }

    // Try to trigger a notification emitter (fire-and-forget)
    try {
      const emitter = strapi.service('api::notification.notification-emitter');
      if (emitter) {
        setImmediate(() => {
          emitter.emit({
            interactionType: 'review_requested',
            contentType: 'project',
            docId: projectId,
            actorDocumentId: user.documentId,
            extra: { requestId: reviewRequest.documentId },
          }).catch(() => {});
        });
      }
    } catch (_) { /* non-blocking */ }

    return { data: reviewRequest };
  },

  /**
   * PATCH /projects/:id/review-requests/:requestId/resolve — Approve, reject, or request changes.
   */
  async resolveReviewRequest(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id: projectId, requestId } = ctx.params;
    const { status, feedback } = ctx.request.body?.data || ctx.request.body;

    if (!status || !['approved', 'changes_requested', 'rejected'].includes(status)) {
      return ctx.badRequest('Valid status (approved, changes_requested, rejected) is required');
    }

    const memberContext = await this.getProjectMember(projectId, user.id);
    if (!memberContext) return ctx.forbidden('You are not a member of this project');

    // Load request details fully
    const request = await strapi.documents('api::review-request.review-request').findOne({
      documentId: requestId,
      populate: ['reviewer', 'workspace_item', 'task', 'requester'],
    });

    if (!request) return ctx.notFound('Review request not found');

    // Verify user is authorized to review
    // Reviewer of the request, Project publisher, or user with admin permission
    const isAdmin = await hasProjectPermission(strapi, projectId, user.id, 'admin');
    const isAssignedReviewer = request.reviewer?.id === memberContext.member.id;

    if (!isAssignedReviewer && !memberContext.isPublisher && !isAdmin) {
      return ctx.forbidden('You do not have permission to resolve this review request');
    }

    if (status === 'approved') {
      // 1. Merge logic if there is a workspace item
      if (request.workspace_item) {
        const workspaceItem = await strapi.documents('api::workspace-item.workspace-item').findOne({
          documentId: request.workspace_item.documentId,
        });

        if (workspaceItem) {
          const project = await strapi.documents('api::project.project').findOne({
            documentId: projectId,
          });

          if (workspaceItem.type === 'document') {
            // Append or update in wiki_docs array
            let wikiDocs = project.wiki_docs;
            if (!Array.isArray(wikiDocs)) {
              wikiDocs = [];
            }

            const existingIndex = wikiDocs.findIndex(doc => doc.id === workspaceItem.documentId || doc.title === workspaceItem.title);
            if (existingIndex > -1) {
              wikiDocs[existingIndex] = {
                id: workspaceItem.documentId,
                title: workspaceItem.title,
                content: workspaceItem.content,
              };
            } else {
              wikiDocs.push({
                id: workspaceItem.documentId,
                title: workspaceItem.title,
                content: workspaceItem.content,
              });
            }

            await strapi.documents('api::project.project').update({
              documentId: projectId,
              data: { wiki_docs: wikiDocs },
            });

          } else if (workspaceItem.type === 'flowchart') {
            // Replace the official project diagram
            await strapi.documents('api::project.project').update({
              documentId: projectId,
              data: { architecture_diagram: workspaceItem.content },
            });
          }

          // Mark workspace item as merged
          await strapi.documents('api::workspace-item.workspace-item').update({
            documentId: workspaceItem.documentId,
            data: { status: 'merged' },
          });
        }
      }

      // 2. Transition task to done
      if (request.task) {
        await strapi.documents('api::task.task').update({
          documentId: request.task.documentId,
          data: { status: 'done' },
        });
      }

    } else if (status === 'changes_requested' || status === 'rejected') {
      // Transition task back to in_progress so the assignee can work on it
      if (request.task) {
        await strapi.documents('api::task.task').update({
          documentId: request.task.documentId,
          data: { status: 'in_progress' },
        });
      }

      // Transition workspace item status back to rejected
      if (request.workspace_item) {
        await strapi.documents('api::workspace-item.workspace-item').update({
          documentId: request.workspace_item.documentId,
          data: { status: 'rejected' },
        });
      }
    }

    // Update review request record
    const resolved = await strapi.documents('api::review-request.review-request').update({
      documentId: requestId,
      data: {
        status,
        feedback: feedback || '',
      },
    });

    return { data: resolved };
  },
}));
