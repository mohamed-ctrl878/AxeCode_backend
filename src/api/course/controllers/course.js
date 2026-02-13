'use strict';

/**
 * course controller
 * Handles Course CRUD operations.
 * Business logic (Entitlement verification, Enrichment)
 * is delegated to api::course.course service for SOLID compliance.
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::course.course', ({ strapi }) => ({
  
  // POST /courses - Create a new course
  async create(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('Authentication required');

    const { data } = ctx.request.body;
    if (!data) return ctx.badRequest('Data is required');

    ctx.request.body.data = {
      ...data,
      users_permissions_user: ctx.state.user.id,
    };

    return await super.create(ctx);
  },

  // GET /courses - Get all published courses with enrichment
  async find(ctx) {
    const userId = ctx.state.user?.id || null;
    
    // Use Strapi default find (handles published/draft automatically)
    const response = await super.find(ctx);
    if (!response || !response.data) return response;

    // Enrich with Entitlements & Interactions
    const enriched = await strapi.service('api::course.course')
      .filterAndEnrichCourses(response.data, userId);

    return ctx.send({
      data: enriched,
      meta: response.meta,
    });
  },

  // GET /courses/:id - Get single course with enrichment
  async findOne(ctx) {
    const userId = ctx.state.user?.id || null;

    // Use Strapi default findOne (handles published/draft automatically)
    const response = await super.findOne(ctx);
    if (!response || !response.data) return response;

    const course = response.data;

    // Enrich with Entitlements & Interactions
    const enriched = await strapi.service('api::course.course')
      .enrichCourse(course, userId);

    if (!enriched) return ctx.notFound('Course not found');

    const isPublisher = userId && (
      enriched.users_permissions_user?.id == userId ||
      enriched.users_permissions_user?.documentId == userId
    );

    return ctx.send({
      data: enriched,
      meta: { isPublisher: isPublisher || false },
    });
  },
}));
