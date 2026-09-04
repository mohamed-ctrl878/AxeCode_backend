'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::user-job-title.user-job-title', ({ strapi }) => ({
  /**
   * POST /users/me/job-titles — Add a job title tag to current user's profile.
   * Body: { job_title_tag_id: string, experience_level: 'junior'|'mid'|'senior' }
   */
  async addMyJobTitle(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { job_title_tag_id, experience_level } = ctx.request.body;

    if (!job_title_tag_id) {
      return ctx.badRequest('job_title_tag_id is required');
    }

    // Validate tag exists and is active
    const tag = await strapi.documents('api::job-title-tag.job-title-tag').findOne({
      documentId: job_title_tag_id,
    });

    if (!tag || !tag.is_active) {
      return ctx.notFound('Job title tag not found or inactive');
    }

    // Check for duplicate
    const existing = await strapi.db.query('api::user-job-title.user-job-title').findOne({
      where: {
        users_permissions_user: user.id,
        job_title_tag: tag.id,
      },
    });

    if (existing) {
      return ctx.badRequest('You already have this job title');
    }

    // Create junction record
    const record = await strapi.documents('api::user-job-title.user-job-title').create({
      data: {
        users_permissions_user: user.documentId,
        job_title_tag: tag.documentId,
        experience_level: experience_level || 'junior',
      },
    });

    return { data: record };
  },

  /**
   * DELETE /users/me/job-titles/:tagId — Remove a job title from current user's profile.
   */
  async removeMyJobTitle(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const { tagId } = ctx.params;

    const record = await strapi.db.query('api::user-job-title.user-job-title').findOne({
      where: {
        users_permissions_user: user.id,
        job_title_tag: { documentId: tagId },
      },
    });

    if (!record) {
      return ctx.notFound('Job title not found on your profile');
    }

    await strapi.documents('api::user-job-title.user-job-title').delete({
      documentId: record.documentId,
    });

    return { data: { message: 'Job title removed' } };
  },

  /**
   * GET /users/me/job-titles — List current user's job titles.
   */
  async getMyJobTitles(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const records = await strapi.documents('api::user-job-title.user-job-title').findMany({
      filters: { users_permissions_user: { documentId: user.documentId } },
      populate: ['job_title_tag'],
    });

    return { data: records };
  },
}));
