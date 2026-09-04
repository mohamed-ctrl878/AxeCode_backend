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
      blog: 'blogs',
      project: 'projects'
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
      case 'payout_request':
        ar = `تم استلام طلب سحب جديد بمبلغ ${extra.amount} ج.م`;
        en = `New payout request received for ${extra.amount} EGP`;
        break;
      case 'payout_paid':
        ar = `تمت الموافقة على طلب السحب الخاص بك بمبلغ ${extra.amount} ج.م وتم التحويل`;
        en = `Your payout request for ${extra.amount} EGP has been approved and paid`;
        break;
      case 'payout_rejected':
        const reason = extra.reason ? ` السبب: ${extra.reason}` : '';
        const reasonEn = extra.reason ? ` Reason: ${extra.reason}` : '';
        ar = `تم رفض طلب السحب الخاص بك بمبلغ ${extra.amount} ج.م.${reason}`;
        en = `Your payout request for ${extra.amount} EGP was rejected.${reasonEn}`;
        break;
      case 'project_apply':
        ar = `${actorName} تقدّم للانضمام إلى مشروعك${extra.roleLabel ? ' كـ ' + extra.roleLabel : ''}`;
        en = `${actorNameEn} applied to join your project${extra.roleLabel ? ' as ' + extra.roleLabel : ''}`;
        break;
      case 'project_invite':
        ar = `${actorName} دعاك للانضمام إلى مشروع`;
        en = `${actorNameEn} invited you to join a project`;
        break;
      case 'project_accepted':
        ar = `تم قبولك في المشروع! يمكنك البدء الآن`;
        en = `You have been accepted to the project! You can start now`;
        break;
      case 'task_assigned':
        ar = `${actorName} أسند إليك مهمة جديدة${extra.taskTitle ? ': ' + extra.taskTitle : ''}`;
        en = `${actorNameEn} assigned you a new task${extra.taskTitle ? ': ' + extra.taskTitle : ''}`;
        break;
      case 'sprint_started':
        ar = `بدأ Sprint جديد في مشروعك${extra.sprintGoal ? ' — ' + extra.sprintGoal : ''}`;
        en = `A new sprint started in your project${extra.sprintGoal ? ' — ' + extra.sprintGoal : ''}`;
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
      payout: 'طلب السحب',
      project: 'مشروعك',
    };
    return map[contentType] || contentType;
  }
};
