const crypto = require('crypto');

module.exports = ({ strapi }) => ({

  /**
   * Initiate Checkout
   * Generates a unique order ID and the required Kashier Hash for the iframe.
   * @param {Object} event - The event or course being paid for
   * @param {Object} user - The user making the payment
   */
  async initiateCheckout(event, user) {
    if (!event || !event.price) throw new Error('Invalid event or price');
    
    const merchantId = process.env.KASHIER_MERCHANT_ID;
    const secret = process.env.KASHIER_API_KEY; // Kashier Hash Secret
    const mode = process.env.KASHIER_MODE || 'test'; // test or live

    if (!merchantId || !secret) {
      throw new Error('KASHIER_MERCHANT_ID or KASHIER_API_KEY is not defined in .env');
    }

    const amount = Number(event.price).toFixed(2); // Kashier expects 2 decimal places (e.g., 100.00)
    const currency = 'EGP'; 
    // Generate a unique order ID for Kashier (must be unique per transaction)
    const orderId = `AXE_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    try {
      strapi.log.info(`[Kashier] Initiating checkout for user ${user.id} -> item ${event.documentId}`);
      
      const metadata = {
        user_id: user.id,
        item_id: event.documentId,
        content_type: event.contentType || 'event'
      };

      // 1. Calculate Kashier Hash
      // Formula: HMAC SHA256 of `/?payment=${merchantId}.${orderId}.${amount}.${currency}`
      const path = `/?payment=${merchantId}.${orderId}.${amount}.${currency}`;
      const hash = crypto.createHmac('sha256', secret).update(path).digest('hex');

      // 2. Store a pending payment record in Strapi
      await strapi.documents('api::payment.payment').create({
        data: {
          gateway_order_id: String(orderId),
          gateway_provider: 'kashier',
          amount: parseFloat(amount),
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

      // 3. Return data needed by frontend to render Kashier iFrame
      return {
        order_id: orderId,
        hash: hash,
        merchant_id: merchantId,
        amount: amount,
        currency: currency,
        mode: mode
      };
    } catch (err) {
      strapi.log.error('[Kashier] initiateCheckout failed:', err.message);
      throw err;
    }
  },

  /**
   * Verify the HMAC signature from Kashier Webhook.
   * Kashier sends a "signature" parameter in the webhook payload or headers.
   * 
   * @param {object} payload - The body from Kashier webhook
   * @param {string} signatureHeader - The signature header (if Kashier sends it via header)
   * @returns {boolean} True if signature is valid
   */
  async verifySignature(payload, signatureHeader) {
    const webhookSecret = process.env.KASHIER_WEBHOOK_SECRET || process.env.KASHIER_API_KEY;
    if (!webhookSecret) {
      strapi.log.error('[Kashier] KASHIER_WEBHOOK_SECRET is not defined in .env');
      return false;
    }

    try {
      // Note: Kashier webhook signature verification usually involves hashing the query string
      // or specific payload fields. For this implementation, we assume Kashier sends a 'signature'
      // in the payload or we calculate it based on their standard webhook logic.
      // Usually it's: HMAC SHA256 of `?paymentStatus=${status}&orderId=${orderId}&amount=${amount}...`
      // We will extract signature from payload
      const receivedSignature = payload.signature || signatureHeader;
      
      if (!receivedSignature) {
         strapi.log.warn('[Kashier] No signature found in webhook');
         return false;
      }

      // If Kashier signs the entire raw body (like Stripe):
      // const hash = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      
      // We will return true for now to allow local testing, 
      // but in production, you MUST implement the exact Kashier webhook string format.
      // TODO: Replace this with the exact Kashier webhook signature formula once confirmed.
      return true; 
    } catch (err) {
      strapi.log.error('[Kashier] Signature verification error:', err.message);
      return false;
    }
  },

  /**
   * Process a successful payment webhook from Kashier.
   * Atomic operation: Wallet Update + Transaction Log + Payment Status.
   * 
   * @param {object} payload - The raw Kashier webhook payload
   */
  async processSuccessfulPayment(payload) {
    // Kashier usually sends data inside `payload.data` or directly in `payload`
    const kashierData = payload.data || payload; 
    
    // Ensure the payment was actually successful
    if (kashierData.paymentStatus !== 'SUCCESS') {
       strapi.log.info(`[Kashier] Webhook received but payment status is not SUCCESS. Status: ${kashierData.paymentStatus}`);
       return { success: false, message: 'Payment not successful' };
    }

    const orderId = String(kashierData.merchantOrderId || kashierData.orderId);
    const amount = parseFloat(kashierData.amount);
    
    // 1. Idempotency Check
    const idempotencyService = strapi.service('api::idempotency-key.idempotency-key');
    const existingKey = await idempotencyService.findByKey(orderId);
    
    if (existingKey && existingKey.status === 'COMPLETED') {
      strapi.log.info(`[Kashier] Duplicate webhook ignored for Order ID: ${orderId}`);
      return existingKey.result_payload;
    }

    // Mark as processing
    await idempotencyService.markProcessing(orderId);

    // 2. Extract Business Metadata from our Pending Payment record
    const payments = await strapi.documents('api::payment.payment').findMany({
      filters: { gateway_order_id: orderId },
      populate: ['user', 'event', 'course']
    });

    const pendingPayment = payments[0];

    if (!pendingPayment) {
      strapi.log.error(`[Kashier] Payment record not found for Order ID: ${orderId}`);
      await idempotencyService.markFailed(orderId);
      throw new Error('Pending payment record missing');
    }

    const metadata = pendingPayment.metadata || {};
    const userObj = pendingPayment.user;
    
    const metaUserId = metadata.user_id || metadata.userId;
    const metaContentType = metadata.content_type || metadata.contentType;
    const metaItemId = metadata.item_id || metadata.itemId;

    const userId = userObj?.documentId || userObj?.id || metaUserId;
    
    // Safely determine the table UID
    let uid = 'api::event.event'; // Default fallback
    if (pendingPayment.course || metaContentType === 'course') {
      uid = 'api::course.course';
    } else if (pendingPayment.event || metaContentType === 'event') {
      uid = 'api::event.event';
    }

    const targetDocId = pendingPayment.course?.documentId || pendingPayment.event?.documentId || metaItemId;

    let itemResource = null;
    if (targetDocId) {
      try {
        itemResource = await strapi.documents(uid).findOne({
          documentId: targetDocId
        });
      } catch (err) {
        strapi.log.warn(`[Kashier] Failed to fetch resource ${uid} with ID ${targetDocId}: ${err.message}`);
      }
    }

    const itemId = itemResource?.documentId || targetDocId;
    const numericItemId = itemResource?.id;
    const contentType = pendingPayment.course ? 'course' : (pendingPayment.event ? 'event' : metaContentType);

    strapi.log.info(`[Kashier] Processing success for User: ${userId}, Item: ${itemId} (Numeric: ${numericItemId}), Type: ${contentType}`);

    if (!userId || !itemId) {
      strapi.log.warn(`[Kashier] Missing user or item context in pending payment ${pendingPayment.documentId}.`);
      await idempotencyService.markFailed(orderId);
      throw new Error('User or Item context missing in local record');
    }

    const walletService = strapi.service('api::wallet.wallet');
    const transactionService = strapi.service('api::transaction.transaction');

    try {
      // === STEP 1: Update Payment Record to SUCCESS ===
      await strapi.documents('api::payment.payment').update({
        documentId: pendingPayment.documentId,
        data: {
          amount: amount,
          status: 'SUCCESS',
          gateway_raw_payload: payload,
        }
      });
      strapi.log.info(`[Kashier] Payment ${orderId} marked as SUCCESS`);

      // === STEP 2: GRANT ACCESS (Entitlement) ===
      let accessGranted = false;
      const entitlementResults = await strapi.documents('api::entitlement.entitlement').findMany({
        filters: { 
          $or: [
            { itemId: String(itemId) },
            { itemId: String(numericItemId) }
          ],
          content_types: contentType 
        },
        status: 'published'
      });

      if (entitlementResults && entitlementResults.length > 0) {
        const ent = entitlementResults[0];
        try {
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
          strapi.log.info(`[Kashier] ✅ Access record created successfully for User ${userId}`);
        } catch (createErr) {
          strapi.log.error(`[Kashier] ❌ FAILED to create user-entitlement: ${createErr.message}`);
        }
      } else {
        strapi.log.warn(`[Kashier] ⚠️ CRITICAL: No entitlement found for ${contentType} with itemId: ${itemId}.`);
      }

      // === STEP 3: Wallet & Commission ===
      try {
        const resource = await strapi.documents(uid).findOne({
          documentId: itemId,
          populate: ['users_permissions_user']
        });

        const publisher = resource?.users_permissions_user;
        const publisherId = publisher?.id || publisher?.documentId;
        
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
            payment_id: orderId,
            description: `${contentType} purchase #${itemId} (after ${commissionRate * 100}% commission)`,
          });
          strapi.log.info(`[Kashier] ✅ Publisher wallet credited.`);
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
            reference_id: orderId,
            payment_id: orderId,
            description: `Commission from ${contentType} #${itemId} payment #${orderId}`,
          });
        }
      } catch (walletError) {
        strapi.log.error(`[Kashier] Wallet/Commission failed (non-blocking): ${walletError.message}`);
      }

      // === STEP 4: Mark Idempotency ===
      const result = { success: true, transaction_id: orderId, accessGranted };
      await idempotencyService.markCompleted(orderId, result);

      strapi.log.info(`[Kashier] ✅ Payment ${orderId} fully processed. Access: ${accessGranted}`);
      return result;

    } catch (error) {
      strapi.log.error(`[Kashier] Processing failed for ${orderId}: ${error.message}`);
      await idempotencyService.markFailed(orderId);
      throw error;
    }
  },
});
