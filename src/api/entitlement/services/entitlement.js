'use strict';

/**
 * entitlement service
 */

const { createCoreService } = require('@strapi/strapi').factories;
const { CONTENT_TYPES, USER_ENTITLEMENT_MAP } = require('../constants');

module.exports = createCoreService('api::entitlement.entitlement', ({ strapi }) => ({
  /**
   * Reusable utility to create an entitlement
   */
  async createEntitlement(entitlementData, publisherUserId, status = 'published') {
    try {
      if (!entitlementData) throw new Error('Entitlement data is required');

      strapi.log.info(`Creating entitlement for user ${publisherUserId}: ${entitlementData.title || 'unnamed'}`);

      const entitlement = await strapi.documents('api::entitlement.entitlement').create({
        data: {
          ...entitlementData,
          users_permissions_user: publisherUserId,
        },
        status: status,
      });

      return entitlement;
    } catch (error) {
      strapi.log.error('Error in createEntitlement utility:', error);
      throw error;
    }
  },

  /**
   * Universal logic to get price, student count, and user access
   */
  async getMetricsAndAccess(itemId, contentType, userId = null) {
    try {
      const entitlements = await strapi.documents('api::entitlement.entitlement').findMany({
        filters: { itemId: itemId, content_types: contentType },
        status: 'published'
      });

      if (!entitlements || entitlements.length === 0) {
        return { price: null, studentCount: 0, hasAccess: false, entitlementId: null };
      }

      const entitlement = entitlements[0];
      const result = {
        price: entitlement.price,
        entitlementId: entitlement.documentId,
        studentCount: 0,
        hasAccess: false
      };

      // Use Centralized Mapping (OCP)
      const targetContentType = USER_ENTITLEMENT_MAP[contentType] || contentType;

      const registrations = await strapi.documents('api::user-entitlement.user-entitlement').findMany({
        filters: { productId: entitlement.documentId, content_types: targetContentType },
        populate: ['users_permissions_user']
      });

      result.studentCount = registrations ? registrations.length : 0;

      if (userId) {
        const userAccess = registrations.find(reg => {
          const regUserId = reg.users_permissions_user?.id || reg.users_permissions_user?.documentId || reg.users_permissions_user;
          return String(regUserId) === String(userId);
        });

        if (userAccess) {
          if (!userAccess.duration) {
            result.hasAccess = true;
          } else {
            result.hasAccess = new Date() <= new Date(userAccess.duration);
          }
        }
      }

      return result;
    } catch (error) {
      strapi.log.error(`Error in getMetricsAndAccess for ${contentType} ${itemId}:`, error.message);
      return { price: null, studentCount: 0, hasAccess: false, entitlementId: null };
    }
  }
}));
