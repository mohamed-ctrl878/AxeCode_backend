'use strict';

const { INTERACTION_CONTENT_MATRIX } = require('../constants');

module.exports = {
  /**
   * Main entry point for emitting notifications.
   * 
   * @param {Object} params
   * @param {string} params.interactionType  - 'like' | 'rate' | 'comment' | 'report'
   * @param {string} params.contentType      - 'course' | 'event' | 'article' | 'blog'
   * @param {string} params.docId            - documentId of the content
   * @param {string} params.actorDocumentId  - documentId of user who performed the interaction (null for anonymous)
   * @param {Object} [params.extra]          - Additional data
   */
  async emit({ interactionType, contentType, docId, actorDocumentId, extra = {} }) {
    // 1. Matrix Validation
    const validTypes = INTERACTION_CONTENT_MATRIX[interactionType];
    if (!validTypes || !validTypes.includes(contentType)) {
      strapi.log.debug(`[NotificationEmitter] Invalid interaction ${interactionType} for ${contentType}`);
      return;
    }

    try {
      // 2. Resolve Owner
      const ownershipResolver = strapi.service('api::notification.ownership-resolver');
      const ownerInfo = await ownershipResolver.resolve(contentType, docId);
      
      if (!ownerInfo || !ownerInfo.ownerDocumentId) {
        strapi.log.debug(`[NotificationEmitter] Could not resolve owner for ${contentType} ${docId}`);
        return;
      }

      // 3. Self-Check (No notify to self)
      if (ownerInfo.ownerDocumentId === actorDocumentId) {
        strapi.log.debug(`[NotificationEmitter] Actor is Owner. Skipping.`);
        return;
      }

      // 4. Check Preferences (Are notifications muted for this type?)
      const preferences = await strapi.documents('api::notification-preference.notification-preference').findFirst({
        filters: { user: { documentId: ownerInfo.ownerDocumentId } }
      });

      if (preferences && preferences.disabled_topics && Array.isArray(preferences.disabled_topics)) {
        if (preferences.disabled_topics.includes(interactionType)) {
          strapi.log.debug(`[NotificationEmitter] Owner muted '${interactionType}'. Skipping.`);
          return;
        }
      }

      // 5. Fetch Actor Info for Template
      let actorParams = null;
      if (actorDocumentId) {
         const actor = await strapi.documents('plugin::users-permissions.user').findFirst({
           filters: { documentId: actorDocumentId },
           select: ['documentId', 'username']
         });
         actorParams = actor;
      }

      // 6. Build Message
      const templateEngine = strapi.service('api::notification.template-engine');
      const messages = await templateEngine.build(interactionType, contentType, docId, actorParams, extra);

      // 7. Compose Payload
      const payload = {
        interactionType,
        contentType,
        contentDocId: docId,
        actor: actorParams, // null if anonymous
        owner: { documentId: ownerInfo.ownerDocumentId, username: ownerInfo.ownerUsername },
        message: {
          ar: messages.ar,
          en: messages.en
        },
        actionUrl: messages.actionUrl,
        extra
      };

      // 8. Deliver
      const deliveryService = strapi.service('api::notification.notification-delivery');
      
      // Fire and forget so we don't block the request
      setImmediate(() => {
        deliveryService.deliver(payload).catch(err => {
          strapi.log.error(`[NotificationEmitter] Background delivery failed: ${err.message}`);
        });
      });

    } catch (err) {
      strapi.log.error(`[NotificationEmitter] Emit Failed: ${err.message}`);
    }
  }
};
