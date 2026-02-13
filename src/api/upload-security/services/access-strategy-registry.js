'use strict';

/**
 * Access Strategy Registry
 * 
 * Strategy Pattern لتحديد صلاحية الوصول للملفات بناءً على نوع المحتوى المربوط.
 * كل content type يمكنه تسجيل strategy خاصة به.
 * 
 * في المرحلة الحالية: جميع الـ strategies ترجع true (placeholder).
 * في المرحلة القادمة: سيتم تطبيق logic التحقق الفعلي لكل نوع.
 * 
 * @example
 * // تسجيل strategy
 * registry.register('api::course.course', async (documentId, userId) => {
 *   const facade = strapi.service('api::entitlement.content-access-facade');
 *   const { hasAccess } = await facade.getFullDetails(documentId, 'course', userId);
 *   return hasAccess;
 * });
 * 
 * // التحقق من الوصول
 * const allowed = await registry.canAccess('api::course.course', 'doc-1', userId);
 */

module.exports = ({ strapi }) => {
  /** @type {Map<string, Function>} */
  const strategies = new Map();

  return {
    /**
     * يسجّل strategy للتحقق من الوصول لنوع محتوى معين
     * 
     * @param {string} contentType - uid الـ content type (e.g. 'api::course.course')
     * @param {Function} strategyFn - async (documentId, userId) => boolean
     */
    register(contentType, strategyFn) {
      if (typeof strategyFn !== 'function') {
        throw new Error(`Strategy for ${contentType} must be a function.`);
      }
      strategies.set(contentType, strategyFn);
      strapi.log.info(`[AccessStrategyRegistry] Registered strategy for ${contentType}`);
    },

    /**
     * يتحقق من صلاحية الوصول بناءً على الـ strategy المسجّلة
     * 
     * @param {string} contentType - uid الـ content type
     * @param {string} documentId - documentId المحتوى المربوط
     * @param {number} userId - ID المستخدم
     * @returns {Promise<boolean>} هل يُسمح بالوصول؟
     */
    async canAccess(contentType, documentId, userId) {
      const strategy = strategies.get(contentType);

      // لا يوجد strategy مسجّل — default: allow (placeholder)
      if (!strategy) {
        strapi.log.debug(
          `[AccessStrategyRegistry] No strategy for ${contentType}, defaulting to ALLOW`
        );
        return true;
      }

      return strategy(documentId, userId);
    },

    /**
     * يرجع قائمة الـ content types المسجّلة
     * @returns {string[]}
     */
    getRegisteredTypes() {
      return Array.from(strategies.keys());
    },

    /**
     * يتحقق من وجود strategy مسجّلة لنوع محتوى
     * @param {string} contentType
     * @returns {boolean}
     */
    hasStrategy(contentType) {
      return strategies.has(contentType);
    },
  };
};
