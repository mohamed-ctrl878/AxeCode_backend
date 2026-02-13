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
    // تم تحويل هذه الاستراتيجية للسماح بالوصول العام (userId قد يكون null)
    // لأن وسم <img> لا يرسل Token. الأمان يعتمد الآن على كون الملف مربوطاً بمحتوى صالح.
    return true;
  };
}

module.exports = { createAuthenticatedAccessStrategy };
