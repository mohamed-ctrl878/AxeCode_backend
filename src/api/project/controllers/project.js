'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::project.project', ({ strapi }) => ({
  /**
   * POST /projects — Create a new project.
   */
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const data = ctx.request.body?.data || ctx.request.body;

    ctx.request.body = {
      data: {
        ...data,
        publisher: user.id,
        status: data.status || 'draft',
      },
    };

    const result = await super.create(ctx);

    // Auto-create publisher as admin member
    if (result?.data?.documentId) {
      try {
        // Create a default "Publisher" role with full admin permissions
        const publisherRole = await strapi.documents('api::project-role.project-role').create({
          data: {
            project: result.data.documentId,
            custom_label: 'Publisher',
            required_level: 'any',
            slots: 1,
            permissions: { read: true, write: true, review: true, admin: true },
            is_open: false,
          },
        });

        // Add publisher as the first member
        await strapi.documents('api::project-member.project-member').create({
          data: {
            project: result.data.documentId,
            users_permissions_user: user.id,
            project_role: publisherRole.documentId,
            github_username: user.github_username || '',
            is_active: true,
          },
        });
      } catch (err) {
        strapi.log.error('[Project] Failed to auto-create publisher role/member:', err.message);
      }
    }

    return result;
  },

  /**
   * GET /projects/:id — Get project details with populated relations.
   */
  async findOne(ctx) {
    const { id } = ctx.params;

    const project = await strapi.documents('api::project.project').findOne({
      documentId: id,
      populate: [
        'publisher',
        'project_roles',
        'project_roles.job_title_tag',
        'project_members',
        'project_members.users_permissions_user',
        'project_members.project_role',
      ],
    });

    if (!project) {
      return ctx.notFound('Project not found');
    }

    return { data: project };
  },

  /**
   * GET /projects — List projects (with optional filters).
   */
  async find(ctx) {
    const { status, methodology, visibility } = ctx.query;
    const limit = parseInt(ctx.query.limit, 10) || 20;
    const start = parseInt(ctx.query.start, 10) || 0;

    const filters = {};
    if (status) filters.status = status;
    if (methodology) filters.methodology = methodology;
    if (visibility) filters.visibility = visibility;

    const projects = await strapi.documents('api::project.project').findMany({
      filters,
      populate: ['publisher', 'project_roles', 'project_roles.job_title_tag'],
      sort: [{ createdAt: 'desc' }],
      limit,
      start,
    });

    return { data: projects };
  },

  /**
   * PUT /projects/:id — Update project settings (admin only).
   */
  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id } = ctx.params;

    // Verify user is project admin
    const project = await strapi.documents('api::project.project').findOne({
      documentId: id,
      populate: ['publisher'],
    });

    if (!project) return ctx.notFound('Project not found');

    if (project.publisher?.id !== user.id) {
      // Check if user has admin permission via project_member
      const membership = await strapi.db.query('api::project-member.project-member').findOne({
        where: {
          project: project.id,
          users_permissions_user: user.id,
          is_active: true,
        },
        populate: { project_role: true },
      });

      if (!membership?.project_role?.permissions?.admin) {
        return ctx.forbidden('Only project admins can update project settings');
      }
    }

    return await super.update(ctx);
  },

  /**
   * DELETE /projects/:id — Archive project (admin only).
   */
  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id } = ctx.params;

    const project = await strapi.documents('api::project.project').findOne({
      documentId: id,
      populate: ['publisher'],
    });

    if (!project) return ctx.notFound('Project not found');

    if (project.publisher?.id !== user.id) {
      return ctx.forbidden('Only the project publisher can archive the project');
    }

    // Soft archive instead of hard delete
    await strapi.documents('api::project.project').update({
      documentId: id,
      data: { status: 'archived' },
    });

    return { data: { message: 'Project archived successfully' } };
  },

  /**
   * PATCH /projects/:id/github-repo
   * Link a GitHub repository to this project (admin only).
   * Body: { github_repo_url, github_repo_id, github_webhook_secret }
   */
  async linkGithubRepo(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { id } = ctx.params;
    const body = ctx.request.body?.data || ctx.request.body;
    const { github_repo_url, github_repo_id, github_webhook_secret } = body;

    const project = await strapi.documents('api::project.project').findOne({
      documentId: id,
      populate: ['publisher'],
    });

    if (!project) return ctx.notFound('Project not found');
    if (project.publisher?.id !== user.id) {
      // Allow project admins too
      const membership = await strapi.db.query('api::project-member.project-member').findOne({
        where: { project: project.id, users_permissions_user: user.id, is_active: true },
        populate: { project_role: true },
      });
      if (!membership?.project_role?.permissions?.admin) {
        return ctx.forbidden('Only project admins can link a GitHub repository');
      }
    }

    const updateData = {};
    if (github_repo_url !== undefined) updateData.github_repo_url = github_repo_url;
    if (github_repo_id !== undefined) updateData.github_repo_id = github_repo_id;
    if (github_webhook_secret !== undefined) updateData.github_webhook_secret = github_webhook_secret;

    const updated = await strapi.documents('api::project.project').update({
      documentId: id,
      data: updateData,
    });

    strapi.log.info(`[Project] GitHub repo linked: project=${id}, repo_url=${github_repo_url}, repo_id=${github_repo_id}`);
    return {
      data: {
        documentId: updated.documentId,
        github_repo_url: updated.github_repo_url,
        github_repo_id: updated.github_repo_id,
        webhook_url: `${strapi.config.server.url || ''}/api/github/webhook`,
        message: 'Repository linked. Configure the webhook URL in your GitHub repo settings.',
      },
    };
  },
}));

