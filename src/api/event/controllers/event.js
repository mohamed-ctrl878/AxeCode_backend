'use strict';

/**
 * event controller
 */
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::event.event', ({ strapi }) => {
  const getLogic = () => strapi.service('api::event.event-logic');

  return {
    async find(ctx) {
      // 1. Ensure relations needed for enrichment are populated
      ctx.query.populate = ctx.query.populate || {
        speakers: true,
        event_activities: true,
        users_permissions_user: true,
        image: true,
        scanners: { populate: { users_permissions_user: true } }
      };

      const response = await super.find(ctx);
      
      if (response.data && Array.isArray(response.data)) {
        const userId = ctx.state.user?.id || null;
        await getLogic().enrichMany(response.data, userId);
      }
      
      return response;
    },

    async findOne(ctx) {
      ctx.query.populate = ctx.query.populate || {
        speakers: true,
        event_activities: true,
        users_permissions_user: true,
        image: true,
        scanners: { populate: { users_permissions_user: true } }
      };

      const response = await super.findOne(ctx);
      
      if (response.data) {
        const userId = ctx.state.user?.id || null;
        await getLogic().enrichEvent(response.data, userId);
      }
      
      return response;
    },

    async create(ctx) {
      const { event, entitlement: entitlementData } = ctx.request.body;
      
      if (!ctx.state.user) return ctx.unauthorized('You must be logged in to create an event.');
      if (!event) return ctx.badRequest('Event data is required.');

      try {
        const eventService = strapi.service('api::event.event');
        const createdEvent = await eventService.createEventWithDetails(event, entitlementData, ctx.state.user);

        return ctx.send({ data: createdEvent });
      } catch (error) {
        strapi.log.error('Event creation failed:', error);
        return ctx.badRequest(error.message || "Failed to create event");
      }
    },
  };
});
