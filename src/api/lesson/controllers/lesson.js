'use strict';

/**
 * lesson controller
 * الدروس يتم الوصول إليها من خلال الـ Course endpoint
 * ما عدا الناشر يمكنه الوصول لدروسه مباشرة
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::lesson.lesson', ({ strapi }) => ({
  
  // POST /lessons - Create a new lesson
  async create(ctx) {
    // التحقق من المصادقة
    if (!ctx.state.user) {
      return ctx.unauthorized('Not authenticated. Please login first.');
    }

    const { data } = ctx.request.body;

    if (!data) {
      return ctx.badRequest('Data is required');
    }

    // Set the user and use Strapi default create (publishes automatically)
    ctx.request.body.data = {
      ...data,
      users_permissions_user: ctx.state.user.id,
    };

    return await super.create(ctx);
  },

  // GET /lessons - جلب الدروس الخاصة بالناشر فقط
  async find(ctx) {
    // التحقق من المصادقة
    if (!ctx.state.user) {
      return ctx.forbidden('Direct access to lessons is not allowed. Please access lessons through the course endpoint.');
    }

    // Scope to current user's lessons only (publisher access)
    ctx.query.filters = {
      ...ctx.query.filters,
      users_permissions_user: { id: ctx.state.user.id },
    };

    const response = await super.find(ctx);
    if (!response || !response.data) return response;

    const userId = ctx.state.user.id;
    const enriched = await Promise.all(
      response.data.map(async (lesson) => strapi.service('api::lesson.lesson').enrichLesson(lesson, userId))
    );

    return ctx.send({
      data: enriched,
      meta: { ...response.meta, isPublisher: true },
    });
  },

  // GET /lessons/:id - الحصول على درس واحد (للناشر فقط)
  async findOne(ctx) {
    // التحقق من المصادقة
    if (!ctx.state.user) {
      return ctx.forbidden('Direct access to lessons is not allowed. Please access lessons through the course endpoint.');
    }

    // Use Strapi default findOne
    const response = await super.findOne(ctx);
    if (!response || !response.data) return response;

    const lesson = response.data;

    // Ownership check — only the publisher can access their own lessons directly
    if (lesson.users_permissions_user?.id !== ctx.state.user.id) {
      return ctx.forbidden('Direct access to lessons is not allowed. Please access lessons through the course endpoint.');
    }

    const enriched = await strapi.service('api::lesson.lesson').enrichLesson(lesson, ctx.state.user.id);

    return ctx.send({ data: enriched });
  },
}));
