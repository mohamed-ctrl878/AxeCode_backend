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
    const user = ctx.state.user;
    const userInfo = user ? { id: user.id, documentId: user.documentId } : null;
    
    // Use Strapi default find (handles published/draft automatically)
    const response = await super.find(ctx);
    if (!response || !response.data) return response;

    // Enrich with Entitlements & Interactions
    const enriched = await strapi.service('api::course.course')
      .filterAndEnrichCourses(response.data, userInfo);

    return ctx.send({
      data: enriched,
      meta: response.meta,
    });
  },

  // GET /courses/:id - Get single course with enrichment
  async findOne(ctx) {
    const user = ctx.state.user;
    const userInfo = user ? { id: user.id, documentId: user.documentId } : null;

    // Use Strapi default findOne (handles published/draft automatically)
    const response = await super.findOne(ctx);
    if (!response || !response.data) return response;

    const course = response.data;

    // Enrich with Entitlements & Interactions
    const enriched = await strapi.service('api::course.course')
      .enrichCourse(course, userInfo);

    if (!enriched) return ctx.notFound('Course not found');

    // Robust Publisher Check (v4 id & v5 documentId)
    const isPublisher = userInfo && (
      (userInfo.id && enriched.users_permissions_user?.id == userInfo.id) || 
      (userInfo.documentId && enriched.users_permissions_user?.documentId == userInfo.documentId)
    );

    return ctx.send({
      data: enriched,
      meta: { isPublisher: isPublisher || false },
    });
  },
}));
