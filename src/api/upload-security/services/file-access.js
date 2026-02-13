'use strict';

/**
 * File Access Service
 * 
 * يوفر منطقاً موحداً للتحقق من صلاحية الوصول لملف معين.
 * يجمع بين فحص الملكية (Owner) وفحص الاستراتيجيات المرتبطة (Strategies).
 */

module.exports = ({ strapi }) => ({
  /**
   * يتحقق مما إذا كان المستخدم يملك صلاحية الوصول للملف
   * 
   * @param {object} file - كائن الملف من قاعدة البيانات (مع populate للـ owner والـ related)
   * @param {number|null} userId - ID المستخدم الطالب للوصول
   * @returns {Promise<boolean>}
   */
  async canAccess(file, userId) {
    if (!file) return false;

    // 1. فحص الملكية (Owner)
    const ownerId = typeof file.owner === 'object' ? file.owner?.id : file.owner;
    if (userId && ownerId && ownerId === userId) {
      return true;
    }

    // 2. فحص الملفات القديمة (بدون owner)
    // نسمح بالوصول إليها حالياً لتجنب تعطل الموقع القديم، مع إمكانية تشديدها لاحقاً
    if (!ownerId) {
      return true;
    }

    // 3. فحص المحتوى المرتبط (Related Content)
    const related = file.related;
    if (!related || related.length === 0) {
      // ملف له صاحب ولكن غير مربوط بمحتوى — لا يسمح لأحد غير صاحبه بالوصول
      return false;
    }

    // 4. استدعاء الـ Access Strategy Registry
    const registry = strapi.service('api::upload-security.access-strategy-registry');
    if (!registry) return true; // fallback if registry missing

    // نتحقق من الوصول لأي من المحتويات المرتبطة (OR logic)
    // إذا كان للمستخدم وصول لواحد منها على الأقل، نسمح له برؤية الملف
    for (const item of related) {
      const contentType = item.__type || item.__contentType;
      const documentId = item.documentId || item.id;
      
      if (contentType) {
        const allowed = await registry.canAccess(contentType, documentId, userId);
        if (allowed) return true;
      }
    }

    return false;
  }
});
