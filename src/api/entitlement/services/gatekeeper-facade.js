'use strict';

/**
 * GatekeeperFacade Service
 * Orchestrates cross-domain validations for "entry" points (e.g., ticket scanning).
 * Ensures a high-level, unified approach to authorization and usage tracking.
 */

module.exports = ({ strapi }) => ({
  /**
   * Main orchestrator for scanning/validating access tokens (Tickets)
   */
  async validateEventAccess(userEntitlementDocId, scannerUserId) {
    // 1. Fetch Entity (UserEntitlement)
    const userEntitlement = await strapi.documents('api::user-entitlement.user-entitlement').findOne({
      documentId: userEntitlementDocId,
      populate: ['users_permissions_user']
    });

    if (!userEntitlement) {
      return { success: false, message: 'Invalid ticket reference', code: 'TICKET_NOT_FOUND' };
    }

    // 2. State Check (Valid/Expired)
    if (userEntitlement.valid === 'expired') {
      return { success: false, message: 'Ticket already consumed', code: 'TICKET_EXPIRED' };
    }

    // 3. Product Context (Entitlement ItemId)
    const entitlements = await strapi.documents('api::entitlement.entitlement').findMany({
      filters: { documentId: userEntitlement.productId }
    });
    const entitlement = entitlements[0];

    if (!entitlement || entitlement.content_types !== 'upevent') {
      return { success: false, message: 'Not an event ticket', code: 'INVALID_PRODUCT' };
    }

    // 4. Domain Validation (Scanner Authority)
    const event = await strapi.documents('api::event.event').findOne({
      documentId: entitlement.itemId,
      populate: { scanners: { populate: ['users_permissions_user'] } }
    });

    if (!event) return { success: false, message: 'Event no longer exists', code: 'EVENT_NOT_FOUND' };

    const isAuthorized = event.scanners?.some(s => s.users_permissions_user?.id === scannerUserId);
    if (!isAuthorized) {
        return { success: false, message: 'You are not an authorized scanner for this event', code: 'UNAUTHORIZED_SCANNER' };
    }

    // 5. Atomic Action: Consume Ticket
    await strapi.documents('api::user-entitlement.user-entitlement').update({
      documentId: userEntitlementDocId,
      data: { valid: 'expired' }
    });

    return {
      success: true,
      message: 'Access granted',
      data: {
        holder: userEntitlement.users_permissions_user?.username,
        event: event.title,
        timestamp: new Date().toISOString()
      }
    };
  }
});
