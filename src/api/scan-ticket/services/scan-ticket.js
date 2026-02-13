'use strict';

/**
 * scan-ticket service (SOLID: Single Responsibility - Business Logic Only)
 * Handles all validation and processing for ticket scanning
 */
const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::scan-ticket.scan-ticket', ({ strapi }) => ({

  /**
   * Validates and processes a ticket scan request via GatekeeperFacade
   */
  async validateAndScanTicket(userEntitlementDocumentId, scannerUserId) {
    const gatekeeper = strapi.service('api::entitlement.gatekeeper-facade');
    return await gatekeeper.validateEventAccess(userEntitlementDocumentId, scannerUserId);
  }
}));
