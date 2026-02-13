'use strict';

/**
 * course-type controller
 * الوصول متاح لكن بدون جلب الـ related content
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::course-type.course-type', ({ strapi }) => ({
  // GET /course-types - جلب كل الأنواع بدون related content
  async find(ctx) {
    // التحقق من وجود populate في الـ query
    if (ctx.query.populate) {
      return ctx.badRequest('Populating related content is not allowed for course-types.');
    }

    // جلب البيانات بدون أي populate
    const courseTypes = await strapi.db.query('api::course-type.course-type').findMany({
      where: { publishedAt: { $notNull: true } },
    });

    return ctx.send({
      data: courseTypes,
      meta: { total: courseTypes.length },
    });
  },

  // GET /course-types/:id - جلب نوع واحد بدون related content
  async findOne(ctx) {
    // التحقق من وجود populate في الـ query
    if (ctx.query.populate) {
      return ctx.badRequest('Populating related content is not allowed for course-types.');
    }

    const { id } = ctx.params;

    const courseType = await strapi.db.query('api::course-type.course-type').findOne({
      where: { id },
    });

    if (!courseType) {
      return ctx.notFound('Course type not found');
    }

    return ctx.send({ data: courseType });
  },
}));
