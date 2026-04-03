'use strict';

module.exports = {
  /**
   * Builds the notification message payload.
   * 
   * @param {string} interactionType 
   * @param {string} contentType 
   * @param {Object} actor 
   * @returns {Object} { ar: string, en: string, actionUrl: string }
   */
  async build(interactionType, contentType, contentDocId, actor, extra = {}) {
    let ar = '';
    let en = '';
    
    // Fallback for anonymous actor (used in reports)
    const actorName = actor ? actor.username : 'مجهول';
    const actorNameEn = actor ? actor.username : 'Anonymous';

    // Content mapping for URLs
    const contentToPath = {
      course: 'courses',
      event: 'events',
      article: 'articles',
      blog: 'blogs'
    };
    
    const actionUrl = `/${contentToPath[contentType]}/${contentDocId}`;

    switch (interactionType) {
      case 'like':
        ar = `${actorName} أعجب بـ ${this._getContentNameAr(contentType)} الخاص(ة) بك`;
        en = `${actorNameEn} liked your ${contentType}`;
        break;
      case 'rate':
        const rate = extra.rate ? ` بـ ${extra.rate} نجوم` : '';
        const rateEn = extra.rate ? ` ${extra.rate} stars` : '';
        ar = `${actorName} قام بتقييم ${this._getContentNameAr(contentType)} الخاص(ة) بك${rate}`;
        en = `${actorNameEn} rated your ${contentType}${rateEn}`;
        break;
      case 'comment':
        ar = `${actorName} علّق على ${this._getContentNameAr(contentType)}`;
        en = `${actorNameEn} commented on your ${contentType}`;
        break;
      case 'report':
        ar = `مستخدم مجهول أبلغ عن ${this._getContentNameAr(contentType)} الخاص(ة) بك`;
        en = `An anonymous user reported your ${contentType}`;
        break;
      default:
        ar = `تفاعل جديد على ${this._getContentNameAr(contentType)}`;
        en = `New interaction on your ${contentType}`;
    }

    return { ar, en, actionUrl };
  },

  _getContentNameAr(contentType) {
    const map = {
      course: 'دورتك',
      event: 'فعاليتك',
      article: 'مقالتك',
      blog: 'المدونة',
    };
    return map[contentType] || contentType;
  }
};
