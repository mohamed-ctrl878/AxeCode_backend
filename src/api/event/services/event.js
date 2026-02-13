'use strict';

/**
 * event service
 */

const { createCoreService } = require('@strapi/strapi').factories;

/**
 * Helpers for formatting (SOLID: Encapsulated within the business layer)
 */
const formatTime = (timeStr) => {
  if (typeof timeStr !== 'string' || !timeStr) return timeStr;
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) return `${timeStr}:00.000`;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(timeStr)) return `${timeStr}.000`;
  return timeStr;
};

const formatDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toISOString();
  } catch (e) {
    return dateStr;
  }
};

module.exports = createCoreService('api::event.event', ({ strapi }) => ({
  /**
   * Complex Event Creation (Speakers, Activities, Scanners, Entitlements)
   * Adheres to SRP: Responsibility is handling the business entity creation.
   */
  async createEventWithDetails(eventData, entitlementData, user) {
    strapi.log.info('--- EVENT SERVICE: ATOMIC CREATION STARTED ---');

    // 1. Prepare Event Metadata
    eventData.users_permissions_user = user.id;
    eventData.date = formatDate(eventData.date);
    const scanners = eventData.scanners || [];
    delete eventData.scanners;

    // 2. Atomic Creation of Speakers
    if (eventData.speakers && Array.isArray(eventData.speakers)) {
      const speakerIds = [];
      for (const speaker of eventData.speakers) {
        if (typeof speaker === 'object') {
          const created = await strapi.documents('api::speaker.speaker').create({
            data: { ...speaker },
            status: eventData.status || 'published'
          });
          if (created?.documentId) speakerIds.push(created.documentId);
        } else {
          speakerIds.push(speaker);
        }
      }
      eventData.speakers = speakerIds;
    }

    // 3. Atomic Creation of Activities
    if (eventData.event_activities && Array.isArray(eventData.event_activities)) {
      const activityIds = [];
      for (const activity of eventData.event_activities) {
        if (typeof activity === 'object') {
          if (activity.from) activity.from = formatTime(activity.from);
          const created = await strapi.documents('api::event-activity.event-activity').create({
            data: { ...activity },
            status: eventData.status || 'published'
          });
          if (created?.documentId) activityIds.push(created.documentId);
        } else {
          activityIds.push(activity);
        }
      }
      eventData.event_activities = activityIds;
    }

    // 4. Create Core Event
    const event = await strapi.documents('api::event.event').create({
      data: eventData,
      status: eventData.status || 'published'
    });

    if (!event) throw new Error("Failed to create the core event records.");

    // 5. Create Scanners (Join records)
    if (scanners.length > 0) {
      for (const userId of scanners) {
        try {
          await strapi.documents('api::scanner.scanner').create({
            data: { users_permissions_user: userId, event: event.documentId },
            status: eventData.status || 'published'
          });
        } catch (e) {
          strapi.log.error(`Scanner creation failed for user ${userId}:`, e.message);
        }
      }
    }

    // 6. Create Entitlement (Price/Duration)
    if (entitlementData) {
      // Map enum values if necessary
      if (entitlementData.content_types === 'events' || entitlementData.content_types === 'event') {
        entitlementData.content_types = 'upevent';
      }
      if (entitlementData.duration) entitlementData.duration = formatDate(entitlementData.duration);

      try {
        await strapi.service('api::entitlement.entitlement').createEntitlement(
          {
            ...entitlementData,
            itemId: event.documentId,
            title: entitlementData.title || `Entitlement for ${event.title}`,
          },
          user.id
        );
      } catch (e) {
        strapi.log.error('Entitlement creation failed but event was created:', e);
      }
    }

    return event;
  }
}));
