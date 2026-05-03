const crypto = require('crypto');
const axios = require('axios'); // We need axios for outgoing requests to Paymob

const PAYMOB_API_URL = 'https://accept.paymob.com/api';

module.exports = ({ strapi }) => ({

  /**
   * 1. Authentication
   * Request an authentication token from Paymob.
   */
  async authenticate() {
    const apiKey = process.env.PAYMOB_API_KEY;
    if (!apiKey) throw new Error('PAYMOB_API_KEY is not defined in .env');

    try {
      const response = await axios.post(`${PAYMOB_API_URL}/auth/tokens`, {
        api_key: apiKey,
      });
      return response.data.token;
    } catch (error) {
      strapi.log.error('[Paymob] Authentication failed:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with payment gateway');
    }
  },

  /**
   * 2. Order Registration
   * Register an order to Paymob API.
   */
  async createOrder(authToken, amountCents, currency, metadata = {}) {
    try {
      const response = await axios.post(`${PAYMOB_API_URL}/ecommerce/orders`, {
        auth_token: authToken,
        delivery_needed: 'false',
        amount_cents: amountCents,
        currency: currency,
        items: [], // For standard ticket, empty items is fine or provide event details
      });
      return response.data.id;
    } catch (error) {
      strapi.log.error('[Paymob] Order creation failed:', error.response?.data || error.message);
      throw new Error('Failed to create payment order');
    }
  },

  /**
   * 3. Payment Key Generation
   * Obtain the payment key needed for the iframe.
   */
  async generatePaymentKey(authToken, orderId, amountCents, currency, user, metadata = {}) {
    const integrationId = process.env.PAYMOB_INTEGRATION_ID;
    if (!integrationId) throw new Error('PAYMOB_INTEGRATION_ID is not defined in .env');

    try {
      const billingData = {
        apartment: 'NA',
        email: user.email || 'customer@example.com',
        floor: 'NA',
        first_name: user.username?.split(' ')[0] || 'AxeCode',
        street: 'NA',
        building: 'NA',
        phone_number: '+201000000000', // Mock/Default since it's not physical delivery
        shipping_method: 'NA',
        postal_code: 'NA',
        city: 'NA',
        country: 'EG',
        last_name: user.username?.split(' ')[1] || 'User',
        state: 'NA',
      };

      const response = await axios.post(`${PAYMOB_API_URL}/acceptance/payment_keys`, {
        auth_token: authToken,
        amount_cents: amountCents,
        expiration: 3600,
        order_id: orderId,
        billing_data: billingData,
        currency: currency,
        integration_id: integrationId,
        lock_order_when_paid: "false"
      });

      return response.data.token;
    } catch (error) {
      strapi.log.error('[Paymob] Payment key generation failed:', error.response?.data || error.message);
      throw new Error('Failed to generate payment key');
    }
  },

  /**
   * Initiate Checkout
   * Orchestrates authenticate -> createOrder -> generatePaymentKey
   * @param {Object} event - The event being paid for
   * @param {Object} user - The user making the payment
   */
  async initiateCheckout(event, user) {
    if (!event || !event.price) throw new Error('Invalid event or price');
    
    // Check if user already owns it
    // The entitlement logic handles fetching price and checking ownership,
    // assuming it has been done before calling this, but we can proceed.
    
    const amountCents = Math.round(Number(event.price) * 100);
    const currency = 'EGP'; // Defaulting to EGP for now

    try {
      strapi.log.info(`[Paymob] Initiating checkout for user ${user.id} -> event ${event.documentId}`);
      
      const authToken = await this.authenticate();
      
      const metadata = {
        user_id: user.id,
        item_id: event.documentId,
        content_type: event.contentType || 'event'
      };

      const orderId = await this.createOrder(authToken, amountCents, currency, metadata);
      
      // NEW: Store a pending payment record in Strapi using strapi.documents (Strapi 5 way)
      await strapi.documents('api::payment.payment').create({
        data: {
          paymob_id: String(orderId),
          amount: amountCents / 100,
          currency: currency,
          status: 'PENDING',
          user: user.documentId,
          event: event.contentType === 'event' ? event.documentId : null,
          course: event.contentType === 'course' ? event.documentId : null,
          metadata: metadata,
          publishedAt: new Date(),
        },
        status: 'published'
      });

      const paymentKey = await this.generatePaymentKey(authToken, orderId, amountCents, currency, user, metadata);

      // We should use an Iframe ID from environment or provide a default
      const iframeId = process.env.PAYMOB_IFRAME_ID; 
      if (!iframeId) throw new Error('PAYMOB_IFRAME_ID is not defined in .env');

      const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`;

      return {
        payment_key: paymentKey,
        order_id: orderId,
        iframe_url: iframeUrl,
      };
    } catch (err) {
      strapi.log.error('[Paymob] initiateCheckout failed:', err.message);
      throw err;
    }
  },

  /**
   * Verify the HMAC signature from Paymob.
   * 
   * @param {object} obj - The "obj" field from Paymob webhook payload

   * @param {string} hmac - The hmac query parameter or header
   * @returns {boolean} True if signature is valid
   */
  async verifySignature(obj, hmac) {
    const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
    if (!hmacSecret) {
      strapi.log.error('[Paymob] PAYMOB_HMAC_SECRET is not defined in .env');
      return false;
    }

    try {
      // Concatenate fields in exactly this order (Paymob Standard)
      // All values must be coerced to strings
      const fields = [
        String(obj.amount_cents),
        String(obj.created_at),
        String(obj.currency),
        String(obj.error_occured),
        String(obj.has_parent_transaction),
        String(obj.id),
        String(obj.integration_id),
        String(obj.is_3d_secure),
        String(obj.is_auth),
        String(obj.is_capture),
        String(obj.is_refunded),
        String(obj.is_standalone_payment),
        String(obj.order.id),
        String(obj.owner),
        String(obj.pending),
        String(obj.source_data.pan),
        String(obj.source_data.sub_type),
        String(obj.source_data.type),
        String(obj.success),
      ];
      const data = fields.join('');

      strapi.log.info(`[Paymob HMAC Debug] Concatenated data: ${data}`);
      strapi.log.info(`[Paymob HMAC Debug] Received hmac: ${hmac}`);

      const hash = crypto
        .createHmac('sha512', hmacSecret)
        .update(data)
        .digest('hex');

      strapi.log.info(`[Paymob HMAC Debug] Computed hash: ${hash}`);
      strapi.log.info(`[Paymob HMAC Debug] Match: ${hash === hmac}`);

      return hash === hmac;
    } catch (err) {
      strapi.log.error('[Paymob] Signature verification error:', err.message);
      return false;
    }
  },

  /**
   * Process a successful payment webhook.
   * Atomic operation: Wallet Update + Transaction Log + Payment Status.
   * 
   * @param {object} payload - The raw Paymob webhook payload
   */
  async processSuccessfulPayment(payload) {
    const obj = payload.obj;
    const paymobId = String(obj.id);
    const amountInCents = obj.amount_cents;
    const amount = amountInCents / 100;
    
    // 1. Idempotency Check
    const idempotencyService = strapi.service('api::idempotency-key.idempotency-key');
    const existingKey = await idempotencyService.findByKey(paymobId);
    
    if (existingKey && existingKey.status === 'COMPLETED') {
      strapi.log.info(`[Paymob] Duplicate webhook ignored for ID: ${paymobId}`);
      return existingKey.result_payload;
    }

    // Mark as processing
    await idempotencyService.markProcessing(paymobId);

    // 2. Extract Business Metadata from our Pending Payment record (using Paymob Order ID)
    const paymobOrderId = String(obj.order.id);
    
    // Using strapi.documents to ensure we get documentIds correctly
    const payments = await strapi.documents('api::payment.payment').findMany({
      filters: { paymob_id: paymobOrderId },
      populate: ['user', 'event', 'course']
    });

    const pendingPayment = payments[0];

    if (!pendingPayment) {
      strapi.log.error(`[Paymob] Payment record not found for Order ID: ${paymobOrderId}`);
      throw new Error('Pending payment record missing');
    }

    const metadata = pendingPayment.metadata || {};
    const userId = pendingPayment.user?.documentId;
    
    // Robust Item identification
    const itemId = pendingPayment.course?.documentId || pendingPayment.event?.documentId || metadata.itemId;
    const contentType = pendingPayment.course ? 'course' : (pendingPayment.event ? 'event' : metadata.contentType);

    strapi.log.info(`[Paymob] Processing success for User: ${userId}, Item: ${itemId}, Type: ${contentType}`);

    if (!userId || !itemId) {
      strapi.log.warn(`[Paymob] Missing user or item context in pending payment ${pendingPayment.id}. User: ${userId}, Item: ${itemId}`);
      await idempotencyService.markFailed(paymobId);
      throw new Error('User or Item context missing in local record');
    }

    const walletService = strapi.service('api::wallet.wallet');
    const transactionService = strapi.service('api::transaction.transaction');

    try {
      // === STEP 1: Update Payment Record to SUCCESS (most important) ===
      await strapi.documents('api::payment.payment').update({
        documentId: pendingPayment.documentId,
        data: {
          amount: amount,
          status: 'SUCCESS',
          gateway_raw_payload: payload,
        }
      });
      strapi.log.info(`[Paymob] Payment ${paymobId} marked as SUCCESS`);

      // === STEP 2: GRANT ACCESS (Entitlement) — TOP PRIORITY ===
      let accessGranted = false;
      const entitlementResults = await strapi.documents('api::entitlement.entitlement').findMany({
        filters: { itemId: itemId, content_types: contentType },
        status: 'published'
      });

      if (entitlementResults && entitlementResults.length > 0) {
        const ent = entitlementResults[0];
        strapi.log.info(`[Paymob] Granting access for User ${userId} to ${contentType} via Entitlement ${ent.documentId}`);

        await strapi.documents('api::user-entitlement.user-entitlement').create({
          data: {
            productId: ent.documentId,
            content_types: contentType,
            users_permissions_user: userId,
            publishedAt: new Date(),
            valid: 'successed',
            strart: new Date().toISOString(),
            duration: ent.duration
          },
          status: 'published'
        });
        accessGranted = true;
        strapi.log.info(`[Paymob] ✅ Access GRANTED for User ${userId}`);
      } else {
        strapi.log.warn(`[Paymob] No entitlement found for ${contentType} ${itemId}. Access not granted.`);
      }

      // === STEP 3: Wallet & Commission (non-blocking) ===
      try {
        const uid = contentType === 'event' ? 'api::event.event' : 'api::course.course';
        const resource = await strapi.documents(uid).findOne({
          documentId: itemId,
          populate: ['users_permissions_user']
        });

        const publisherId = resource?.users_permissions_user?.id;
        const platformWallet = await walletService.getPlatformWallet();

        let publisherShare = amount;
        let platformShare = 0;

        if (publisherId) {
          const publisherWallet = await walletService.findOrCreateWallet(publisherId, 'publisher');
          const commissionRate = parseFloat(publisherWallet.commission_rate) || 0.10;
          platformShare = Math.round(amount * commissionRate * 100) / 100;
          publisherShare = amount - platformShare;

          // Credit Publisher Wallet
          await walletService.creditWallet(publisherWallet.id, publisherShare);
          await transactionService.createEntry({
            wallet: publisherWallet.id,
            amount: publisherShare,
            type: 'CREDIT',
            status: 'COMPLETED',
            reference_type: 'CONTENT_PURCHASE',
            reference_id: String(itemId),
            payment_id: paymobId,
            description: `${contentType} purchase #${itemId} (after ${commissionRate * 100}% commission)`,
          });
          strapi.log.info(`[Paymob] Publisher wallet credited: +${publisherShare}`);
        }

        // Credit Platform Wallet (Commission)
        if (platformWallet && platformShare > 0) {
          await walletService.creditWallet(platformWallet.id, platformShare);
          await transactionService.createEntry({
            wallet: platformWallet.id,
            amount: platformShare,
            type: 'CREDIT',
            status: 'COMPLETED',
            reference_type: 'COMMISSION',
            reference_id: paymobId,
            payment_id: paymobId,
            description: `Commission from ${contentType} #${itemId} payment #${paymobId}`,
          });
          strapi.log.info(`[Paymob] Platform commission credited: +${platformShare}`);
        }
      } catch (walletError) {
        // Wallet failure must NOT block the user's access
        strapi.log.error(`[Paymob] Wallet/Commission failed (non-blocking): ${walletError.message}`);
      }

      // === STEP 4: Mark Idempotency ===
      const result = { success: true, transaction_id: paymobId, accessGranted };
      await idempotencyService.markCompleted(paymobId, result);

      strapi.log.info(`[Paymob] ✅ Payment ${paymobId} fully processed. Access: ${accessGranted}`);
      return result;

    } catch (error) {
      strapi.log.error(`[Paymob] Processing failed for ${paymobId}: ${error.message}`);
      await idempotencyService.markFailed(paymobId);
      throw error;
    }
  },
});
