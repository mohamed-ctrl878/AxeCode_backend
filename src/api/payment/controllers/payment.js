'use strict';

/**
 * Payment Controller
 * 
 * Handles incoming webhooks from Paymob.
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::payment.payment', ({ strapi }) => ({

  /**
   * POST /api/payments/initiate
   * Authenticated endpoint to start the checkout process.
   */
  async initiate(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const body = ctx.request.body.data || ctx.request.body;
    const { itemId, contentType = 'event' } = body;
    // Backward compatibility for old frontend calls using eventId
    const targetId = itemId || body.eventId;

    if (!targetId) return ctx.badRequest('itemId or eventId is required');

    try {
      // 1. Fetch metrics and price from Entitlements logic
      const entitlementResult = await strapi.service('api::entitlement.entitlement')
        .getMetricsAndAccess(targetId, contentType, user.id);

      if (entitlementResult.hasAccess) {
        return ctx.badRequest(`You already have access to this ${contentType}`);
      }

      const price = entitlementResult.price;
      if (!price || Number(price) <= 0) {
        return ctx.badRequest(`This ${contentType} is free or has an invalid price`);
      }

      // Mock a resource object for the service
      const resourceMock = {
        documentId: targetId,
        price: price,
        contentType: contentType
      };

      // 2. Initiate checkout
      const data = await strapi.service('api::payment.paymob').initiateCheckout(resourceMock, user);

      return ctx.send({ data });
    } catch (error) {
      strapi.log.error(`[Payment Controller] initiate failed for ${contentType} ${targetId}:`, error.message);
      return ctx.internalServerError(error.message || 'Failed to initiate payment');
    }
  },

  /**
   * POST /api/payments/webhook
   * Public endpoint for Paymob notifications.
   */
  async webhook(ctx) {
    strapi.log.info(`[Webhook] === INCOMING WEBHOOK ===`);
    strapi.log.info(`[Webhook] IP: ${ctx.request.ip || ctx.ip}`);
    strapi.log.info(`[Webhook] Query params: ${JSON.stringify(ctx.query)}`);
    strapi.log.info(`[Webhook] Has body: ${!!ctx.request.body}`);
    strapi.log.info(`[Webhook] Has body.obj: ${!!ctx.request.body?.obj}`);
    strapi.log.info(`[Webhook] hmac from query: ${ctx.query.hmac ? 'present' : 'MISSING'}`);
    
    const payload = ctx.request.body;
    const hmac = ctx.query.hmac;

    // 0. IP Allowlist (Security Hardening)
    // Paymob Public Webhook IPs: 196.223.151.72, 196.223.151.73
    const allowedIps = process.env.PAYMOB_ALLOWED_IPS ? process.env.PAYMOB_ALLOWED_IPS.split(',') : ['196.223.151.72', '196.223.151.73'];
    
    // In many cloud environments, we need to check x-forwarded-for
    const clientIp = ctx.request.ip || ctx.ip;
    
    // For development, we might skip this if requested or if ENV is set
    if (process.env.NODE_ENV === 'production' && !allowedIps.includes(clientIp)) {
      strapi.log.warn(`[Paymob] Webhook attempt from unauthorized IP: ${clientIp}`);
      // return ctx.forbidden('Unauthorized origin'); 
      // Note: In some proxy setups, ctx.ip might be internal. 
      // We will log it for now or strictly enforce if environment allows.
    }

    if (!payload || !hmac) {
      return ctx.badRequest('Missing payload or signature');
    }

    // 1. Verify Signature (skip in development for testing)
    const paymobService = strapi.service('api::payment.paymob');
    
    if (process.env.NODE_ENV === 'production') {
      const isValid = await paymobService.verifySignature(payload.obj, hmac);
      if (!isValid) {
        strapi.log.warn('[Paymob] Invalid signature received in webhook');
        return ctx.forbidden('Invalid signature');
      }
    } else {
      strapi.log.warn('[Paymob] HMAC verification SKIPPED (development mode)');
    }

    // 2. Process based on transaction success
    const isSuccess = payload.type === 'TRANSACTION' && payload.obj.success === true;

    if (!isSuccess) {
      strapi.log.info(`[Paymob] Non-success webhook received for ID: ${payload.obj.id}`);
      // We still return 200 to Paymob to stop retries for failed payments
      return ctx.send({ status: 'ignored' });
    }

    try {
      // 3. Hand off to service for atomic wallet update
      const result = await paymobService.processSuccessfulPayment(payload);
      return ctx.send(result);
    } catch (error) {
      strapi.log.error('[Paymob Webhook] Processing error:', error.message);
      
      // Return 500 so Paymob retries (unless it's an idempotency issue handled inside)
      return ctx.internalServerError('Processing failed');
    }
  },
}));
