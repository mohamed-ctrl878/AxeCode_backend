'use strict';

/**
 * scan-ticket controller (SOLID: Single Responsibility - HTTP Handling Only)
 * Handles HTTP requests and delegates to service layer
 */
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::scan-ticket.scan-ticket', ({ strapi }) => ({

  /**
   * POST /api/scan-ticket/:documentId
   * Scans a ticket and validates entry permission
   */
  async scanTicket(ctx) {
    const { documentId } = ctx.params;

    // Validate authentication
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to scan tickets');
    }

    // Validate input
    if (!documentId) {
      return ctx.badRequest('Ticket documentId is required');
    }

    try {
      const scanTicketService = strapi.service('api::scan-ticket.scan-ticket');
      const result = await scanTicketService.validateAndScanTicket(documentId, ctx.state.user.id);

      if (!result.success) {
        // Return appropriate error based on code
        switch (result.code) {
          case 'TICKET_NOT_FOUND':
          case 'PRODUCT_NOT_FOUND':
          case 'EVENT_NOT_FOUND':
            return ctx.notFound(result.message);
          case 'TICKET_EXPIRED':
          case 'NOT_EVENT_TICKET':
            return ctx.badRequest(result.message);
          case 'UNAUTHORIZED_SCANNER':
            return ctx.forbidden(result.message);
          default:
            return ctx.badRequest(result.message);
        }
      }

      return ctx.send({
        success: true,
        message: result.message,
        data: result.data
      });

    } catch (error) {
      strapi.log.error('Scan ticket error:', error);
      return ctx.internalServerError('An error occurred while scanning the ticket');
    }
  }
}));
