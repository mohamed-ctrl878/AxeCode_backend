'use strict';

/**
 * EventLogic Service
 * Handles data enrichment for events (Speakers, Metrics, etc.)
 */

const { CONTENT_TYPES } = require('../../entitlement/constants');

module.exports = ({ strapi }) => ({
  /**
   * Enriches a single event with speakers and metrics
   */
  async enrichEvent(event, userId = null) {
    if (!event) return null;

    await this.enrichSpeakers(event);
    await this.enrichMetrics(event, userId);

    return event;
  },

  /**
   * Enriches multiple events (optimized via Facade)
   */
  async enrichMany(events, userId = null) {
    const facade = strapi.service('api::entitlement.content-access-facade');
    return await facade.enrichCollection(events, CONTENT_TYPES.EVENT, userId);
  },

  /**
   * Logic to fetch and attach speaker user data
   */
  async enrichSpeakers(event) {
    if (event && event.speakers && Array.isArray(event.speakers)) {
      for (const speaker of event.speakers) {
        const userId = speaker.userId;
        if (userId) {
          try {
            const user = await strapi.db.query('plugin::users-permissions.user').findOne({
              where: { id: userId },
              populate: { avatar: true }
            });

            if (user) {
              speaker.userData = {
                id: user.id,
                username: user.username,
                avatar: user.avatar
              };
              delete speaker.userId;
            }
          } catch (error) {
            strapi.log.error(`[EventLogic] Error (enrichSpeakers) for ID ${userId}: ${error.message}`);
          }
        }
      }
    }
  },

  /**
   * Logic to fetch and attach metrics via Facade
   */
  async enrichMetrics(event, userId = null) {
    const facade = strapi.service('api::entitlement.content-access-facade');
    const details = await facade.getFullDetails(event.documentId, CONTENT_TYPES.EVENT, userId);

    const isPublisher = userId && (
      event.users_permissions_user?.id == userId || 
      event.users_permissions_user?.documentId == userId
    );

    event.price = details.price;
    event.student_count = details.studentCount;
    event.hasAccess = isPublisher || details.hasAccess;
    event.entitlementsId = details.entitlementId;

    // Enrich with Interactions
    const interactionFacade = strapi.service('api::rate.interaction-facade');
    event.interactions = await interactionFacade.getMetadata(CONTENT_TYPES.EVENT, event.documentId, userId);
  }
});
