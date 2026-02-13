const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::rate.rate', ({ strapi }) => ({
  /**
   * Calculate average rating and total raters for a specific content
   */
  async getSummary(contentType, docId) {
    const rates = await strapi.documents('api::rate.rate').findMany({
      filters: {
        content_types: contentType,
        docId: docId
      },
      fields: ['rate'],
    });

    const total = rates.length;
    if (total === 0) return { average: 0, total: 0 };

    const sum = rates.reduce((acc, curr) => acc + (curr.rate || 0), 0);
    const average = parseFloat((sum / total).toFixed(1));

    return { average, total };
  }
}));
