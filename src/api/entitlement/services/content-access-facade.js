'use strict';

/**
 * ContentAccessFacade Service
 * Unified interface for retrieving enriched content across the platform.
 * Orchestrates Entitlement, Course, and Event services.
 */

const { CONTENT_TYPES } = require('../constants');

module.exports = ({ strapi }) => ({
  /**
   * Main entry point: Gets a unified content object with all metrics
   * @param {string} documentId 
   * @param {string} contentType (COURSE, EVENT, LIVESTREAM)
   * @param {number} userId 
   */
  async getFullDetails(documentId, contentType, userId = null) {
    const entitlementService = strapi.service('api::entitlement.entitlement');
    
    // 1. Get Base Metrics (Price, Access, Count)
    const metrics = await entitlementService.getMetricsAndAccess(documentId, contentType, userId);

    // 2. Map to a unified structure
    return {
      price: metrics.price,
      studentCount: metrics.studentCount,
      hasAccess: metrics.hasAccess,
      entitlementId: metrics.entitlementId,
    };
  },

  /**
   * Specialized Enricher for Collections (DRY helper)
   */
  async enrichCollection(items, contentType, userId = null) {
    if (!items || !Array.isArray(items)) return [];

    await Promise.all(items.map(async (item) => {
        const details = await this.getFullDetails(item.documentId, contentType, userId);
        
        // Business Rule: Publisher always has access
        const isPublisher = userId && (
            item.users_permissions_user?.id == userId || 
            item.users_permissions_user?.documentId == userId
        );

        item.price = details.price;
        item.student_count = details.studentCount;
        item.hasAccess = isPublisher || details.hasAccess;
        item.entitlementsId = details.entitlementId;
    }));

    return items;
  }
});
