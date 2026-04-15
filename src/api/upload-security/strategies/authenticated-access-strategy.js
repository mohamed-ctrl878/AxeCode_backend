'use strict';

/**
 * Authenticated Access Strategy
 * 
 * Strategy بسيط — أي مستخدم مصادق (authenticated) يحق له الوصول.
 * يُستخدم للملفات المربوطة بأنواع محتوى عامة مثل:
 * articles, blogs, comments, course picture, events, user avatar
 * 
 * @module authenticated-access-strategy
 */

/**
 * ينشئ strategy function تسمح لأي مستخدم مصادق بالوصول
 * 
 * @returns {Function} async (documentId, userId) => boolean
 */
function createAuthenticatedAccessStrategy() {
  /**
   * @param {string} _documentId - documentId المحتوى (غير مستخدم)
   * @param {number} userId - ID المستخدم
   * @returns {Promise<boolean>}
   */
  return async function authenticatedAccessStrategy(_documentId, userId) {
    // We require a valid userId for this strategy.
    // Logic for public/guest access should be handled by specific strategies (e.g. lesson-access) 
    // or by checking content sensitivity.
    return !!userId;
  };
}

module.exports = { createAuthenticatedAccessStrategy };
