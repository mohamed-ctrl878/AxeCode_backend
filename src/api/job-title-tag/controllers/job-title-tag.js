'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::job-title-tag.job-title-tag', ({ strapi }) => ({
  /**
   * GET /job-title-tags — List all active tags (public, filterable by category).
   */
  async find(ctx) {
    const { category } = ctx.query;

    const filters = { is_active: true };
    if (category) {
      filters.category = category;
    }

    const tags = await strapi.documents('api::job-title-tag.job-title-tag').findMany({
      filters,
      sort: [{ category: 'asc' }, { label_en: 'asc' }],
    });

    return { data: tags };
  },
}));
