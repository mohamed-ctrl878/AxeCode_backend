'use strict';

/**
 * LiveStream Enrichment Service
 * Handles data enrichment for live streams (Metrics, Interactions).
 * Follows the same pattern used in Event (event-logic.js) and Course services.
 */

const { CONTENT_TYPES } = require('../../entitlement/constants');

module.exports = ({ strapi }) => ({
    /**
     * Enriches a single live-stream with entitlement metrics and interactions.
     * @param {object} stream - The live-stream entity
     * @param {number|null} userId - The requesting user's ID
     * @returns {object} Enriched stream
     */
    async enrichStream(stream, userId = null) {
        if (!stream) return null;

        const facade = strapi.service('api::entitlement.content-access-facade');
        const details = await facade.getFullDetails(stream.documentId, CONTENT_TYPES.LIVESTREAM, userId);

        // Publisher check: live-stream uses `host` instead of `users_permissions_user`
        const isPublisher = userId && (
            stream.host?.id == userId ||
            stream.host?.documentId == userId
        );

        stream.price = details.price;
        stream.student_count = details.studentCount;
        stream.hasAccess = isPublisher || details.hasAccess;
        stream.entitlementsId = details.entitlementId;

        // Interaction Metadata (Social Facade)
        const interactionFacade = strapi.service('api::rate.interaction-facade');
        stream.interactions = await interactionFacade.getMetadata(CONTENT_TYPES.LIVESTREAM, stream.documentId, userId);

        return stream;
    },

    /**
     * Enriches multiple live-streams using content-access-facade batch enrichment.
     * @param {Array} streams - Array of live-stream entities
     * @param {number|null} userId - The requesting user's ID
     * @returns {Array} Enriched streams
     */
    async enrichMany(streams, userId = null) {
        if (!streams || !Array.isArray(streams)) return [];
        return Promise.all(streams.map(stream => this.enrichStream(stream, userId)));
    }
});
