'use strict';

/**
 * week controller
 * الأسابيع يتم الوصول إليها من خلال الـ Course endpoint
 * ما عدا الناشر يمكنه الوصول لأسابيعه مباشرة
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::week.week', ({ strapi }) => ({
  
  // POST /weeks - Create a new week
  async create(ctx) {
    // التحقق من المصادقة
    if (!ctx.state.user) {
      return ctx.unauthorized('Not authenticated. Please login first.');
    }

    const { data } = ctx.request.body;

    if (!data) {
      return ctx.badRequest('Data is required');
    }

    // Set the user and use Strapi default create
    ctx.request.body.data = {
      ...data,
      users_permissions_user: ctx.state.user.id,
    };

    return await super.create(ctx);
  },

  // GET /weeks - جلب الأسابيع الخاصة بالناشر فقط
  async find(ctx) {
    // التحقق من المصادقة
    if (!ctx.state.user) {
      return ctx.forbidden('Direct access to weeks is not allowed. Please access lessons through the course endpoint.');
    }

    // Use Strapi default find (no custom status filtering)
    ctx.query.filters = {
      ...ctx.query.filters,
      users_permissions_user: { id: ctx.state.user.id },
    };
    ctx.query.populate = ctx.query.populate || {
      lessons: true,
      course: true,
      users_permissions_user: true,
    };

    const response = await super.find(ctx);

    return ctx.send({
      data: response.data,
      meta: { ...response.meta, isPublisher: true },
    });
  },

  // GET /weeks/:id - الحصول على أسبوع واحد (للناشر فقط)
  async findOne(ctx) {
    // التحقق من المصادقة
    if (!ctx.state.user) {
      return ctx.forbidden('Direct access to weeks is not allowed. Please access lessons through the course endpoint.');
    }

    // Use Strapi default findOne (no custom status filtering)
    ctx.query.populate = ctx.query.populate || {
      lessons: true,
      course: true,
      users_permissions_user: true,
    };

    const response = await super.findOne(ctx);
    if (!response || !response.data) return ctx.notFound('Week not found');

    const week = response.data;

    // التحقق من أن المستخدم هو الناشر
    if (week.users_permissions_user?.id !== ctx.state.user.id) {
      return ctx.forbidden('Direct access to weeks is not allowed. Please access lessons through the course endpoint.');
    }

    return ctx.send({ data: week });
  },
}));
