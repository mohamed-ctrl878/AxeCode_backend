'use strict';

module.exports = {
  /**
   * Emits a detailed notification to the admin system (stored in admin_notifications).
   */
  async emit({ type, contentType, docId, actorDocumentId, extra }) {
    try {
      // Find the actor User if actorDocumentId exists
      let actorName = 'System';
      if (actorDocumentId) {
        const actor = await strapi.documents('plugin::users-permissions.user').findFirst({
          filters: { documentId: actorDocumentId },
          select: ['username']
        });
        if (actor) {
          actorName = actor.username;
        }
      }

      const map = {
        course: 'دورة',
        event: 'فعالية',
        article: 'مقال',
        blog: 'مدونة',
      };
      
      const contentNameAr = map[contentType] || contentType;

      let messageAr = '';
      let messageEn = '';

      if (type === 'content_reported') {
        messageAr = `قام ${actorName} بالإبلاغ عن ${contentNameAr}`;
        messageEn = `${actorName} reported a ${contentType}`;
      } else {
        messageAr = `تنبيه نظام من نوع ${type} على ${contentNameAr}`;
        messageEn = `System alert ${type} for ${contentType}`;
      }

      await strapi.documents('api::admin-notification.admin-notification').create({
        data: {
          type,
          content_type: contentType,
          content_doc_id: docId,
          actor: actorDocumentId,
          message_ar: messageAr,
          message_en: messageEn,
          extra,
          status: 'PENDING',
          read: false,
          publishedAt: new Date()
        },
        status: 'published'
      });

      strapi.log.info(`[AdminNotification] Generated report for ${contentType} ${docId} by ${actorName}`);
    } catch (err) {
      strapi.log.error(`[AdminNotification] Failed to emit: ${err.message}`);
    }
  }
};
