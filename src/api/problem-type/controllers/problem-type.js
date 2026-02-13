'use strict';

/**
 * problem-type controller
 * الوصول متاح لكن بدون جلب الـ related content
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::problem-type.problem-type', ({ strapi }) => ({
  // GET /problem-types - جلب كل الأنواع بدون related content
  async find(ctx) {
    // التحقق من وجود populate في الـ query
    if (ctx.query.populate) {
      return ctx.badRequest('Populating related content is not allowed for problem-types.');
    }

    // جلب البيانات بدون أي populate
    const problemTypes = await strapi.db.query('api::problem-type.problem-type').findMany({
      where: { publishedAt: { $notNull: true } },
    });

    return ctx.send({
      data: problemTypes,
      meta: { total: problemTypes.length },
    });
  },

  // GET /problem-types/:id - جلب نوع واحد بدون related content
  async findOne(ctx) {
    // التحقق من وجود populate في الـ query
    if (ctx.query.populate) {
      return ctx.badRequest('Populating related content is not allowed for problem-types.');
    }

    const { id } = ctx.params;

    const problemType = await strapi.db.query('api::problem-type.problem-type').findOne({
      where: { id },
    });

    if (!problemType) {
      return ctx.notFound('Problem type not found');
    }

    return ctx.send({ data: problemType });
  },
}));
