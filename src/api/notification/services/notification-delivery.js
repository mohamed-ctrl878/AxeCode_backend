'use strict';

const webPush = require('web-push');

// Configuration for web-push should ideally run once on bootstrap, 
// but we set it up here as a fallback or initialize per call if keys exist.
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@axecode.com';

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

module.exports = {
  /**
   * Delivers the notification payload via Socket.io, DB, and Web Push.
   */
  async deliver(payload) {
    // 1. Database (In-App Store)
    try {
      await strapi.documents('api::notification.notification').create({
        data: {
          type: payload.interactionType,
          content_type: payload.contentType,
          content_doc_id: payload.contentDocId,
          actor: payload.actor ? payload.actor.documentId : null,
          owner: payload.owner ? payload.owner.documentId : null,
          message_ar: payload.message.ar,
          message_en: payload.message.en,
          action_url: payload.actionUrl,
          extra: payload.extra,
          read: false,
          publishedAt: new Date()
        },
        status: 'published'
      });
    } catch (dbErr) {
      strapi.log.error(`[NotificationDelivery] DB Insert Error: ${dbErr.message}`);
    }

    // 2. Socket.io (Real-time)
    if (strapi.io && payload.owner && payload.owner.documentId) {
      try {
        const ownerRoom = `user:${payload.owner.documentId}`;
        strapi.io.to(ownerRoom).emit('notification:new', payload);
      } catch (sockErr) {
        strapi.log.error(`[NotificationDelivery] Socket Emit Error: ${sockErr.message}`);
      }
    }

    // 3. Web Push (VAPID)
    if (vapidPublicKey && vapidPrivateKey && payload.owner && payload.owner.documentId) {
      try {
        const subscriptions = await strapi.documents('api::push-subscription.push-subscription').findMany({
          filters: { user: { documentId: payload.owner.documentId }, is_active: true },
        });

        const notifyPayload = JSON.stringify({
          title: payload.message.en,
          body: payload.message.ar,
          url: payload.actionUrl || '/'
        });

        for (const sub of subscriptions) {
          try {
            await webPush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
              notifyPayload
            );
          } catch (pushErr) {
            strapi.log.error(`[NotificationDelivery] Push Error for sub ${sub.documentId}: ${pushErr.message}`);
            if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
              // Gone - marks subscription as inactive
              await strapi.documents('api::push-subscription.push-subscription').update({
                documentId: sub.documentId,
                data: { is_active: false }
              });
            }
          }
        }
      } catch (pushWrapErr) {
         strapi.log.error(`[NotificationDelivery] Push Wrap Error: ${pushWrapErr.message}`);
      }
    }
  }
};
