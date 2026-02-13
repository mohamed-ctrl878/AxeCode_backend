'use strict';

/**
 * File Ownership Middleware (Document Service Middleware)
 * 
 * يعترض عمليات create/update على جميع content types ويتحقق من:
 * 1. ملكية الملفات (file ownership) — هل المستخدم مالك الملف؟
 * 2. ملكية المحتوى (content ownership) — هل المستخدم مالك المحتوى اللي يربط الملف فيه؟
 * 
 * @module file-ownership-middleware
 */

/** Owner field name used across all content types */
const OWNER_FIELD = 'users_permissions_user';

/**
 * يستخرج IDs الملفات من قيمة حقل media
 * يدعم: رقم مفرد، كائن بـ id، أو مصفوفة
 * 
 * @param {number|object|Array} fieldValue - قيمة حقل media
 * @returns {number[]} مصفوفة IDs الملفات
 */
function extractFileIds(fieldValue) {
  if (!fieldValue) return [];

  // Single file: number (id directly)
  if (typeof fieldValue === 'number') return [fieldValue];

  // Single file: object with id
  if (typeof fieldValue === 'object' && !Array.isArray(fieldValue) && fieldValue.id) {
    return [fieldValue.id];
  }

  // Multiple files: array
  if (Array.isArray(fieldValue)) {
    return fieldValue
      .map(item => (typeof item === 'number' ? item : item?.id))
      .filter(Boolean);
  }

  return [];
}

/**
 * يجد حقول media في schema الـ content type
 * 
 * @param {object} attributes - خصائص الـ content type
 * @returns {string[]} أسماء حقول media
 */
function findMediaFields(attributes) {
  if (!attributes) return [];
  return Object.entries(attributes)
    .filter(([, attr]) => attr.type === 'media')
    .map(([name]) => name);
}

/**
 * يستخرج user ID من قيمة حقل المالك
 * يدعم: رقم مفرد، كائن بـ id، أو مصفوفة من كائنات
 * 
 * @param {number|object|Array} ownerValue
 * @returns {number|null}
 */
function extractOwnerId(ownerValue) {
  if (!ownerValue) return null;
  if (typeof ownerValue === 'number') return ownerValue;
  if (typeof ownerValue === 'object' && ownerValue.id) return ownerValue.id;
  // connect format: { connect: [{ id: 1 }] }
  if (ownerValue.connect && Array.isArray(ownerValue.connect) && ownerValue.connect[0]?.id) {
    return ownerValue.connect[0].id;
  }
  return null;
}

/**
 * يتحقق من ملكية المحتوى — هل المستخدم الحالي هو مالك المحتوى؟
 * 
 * @param {object} context - Document Service context
 * @param {number} userId - المستخدم الحالي
 * @param {object} strapi - Strapi instance
 */
async function validateContentOwnership(context, userId, strapi) {
  const attributes = context.contentType?.attributes;

  // Content type لا يحتوي حقل المالك — skip
  if (!attributes?.[OWNER_FIELD]) return;

  if (context.action === 'create') {
    // للإنشاء — يجب أن يكون المالك في data هو المستخدم الحالي
    const dataOwnerId = extractOwnerId(context.params?.data?.[OWNER_FIELD]);
    if (dataOwnerId && dataOwnerId !== userId) {
      throw new Error(
        `Unauthorized: Cannot create ${context.uid} on behalf of another user.`
      );
    }
  }

  if (context.action === 'update') {
    // للتعديل — نجلب المحتوى القائم ونتحقق من مالكه
    const documentId = context.params?.documentId;
    if (!documentId) return;

    const existing = await strapi.db.query(context.uid).findOne({
      where: { documentId },
      populate: [OWNER_FIELD],
    });

    if (!existing) return;

    const existingOwnerId = extractOwnerId(existing[OWNER_FIELD]);
    if (existingOwnerId && existingOwnerId !== userId) {
      throw new Error(
        `Unauthorized: You do not own this ${context.uid}. Cannot modify it.`
      );
    }
  }
}

/**
 * يتحقق من ملكية الملفات — هل المستخدم مالك كل ملف يتم ربطه؟
 */
async function validateFileOwnership(context, userId, strapi) {
  const mediaFields = findMediaFields(context.contentType?.attributes);
  if (mediaFields.length === 0) return;

  const data = context.params?.data;
  if (!data) return;

  for (const fieldName of mediaFields) {
    const fileIds = extractFileIds(data[fieldName]);
    if (fileIds.length === 0) continue;

    for (const fileId of fileIds) {
      const file = await strapi.db.query('plugin::upload.file').findOne({
        where: { id: fileId },
        select: ['id', 'owner'],
      });

      if (!file) {
        throw new Error(`File with id ${fileId} not found.`);
      }

      // ملفات بدون owner (قديمة) — allow
      if (!file.owner) continue;

      // تحقق من الملكية
      if (file.owner !== userId) {
        throw new Error(
          `Unauthorized: You do not own file ${fileId}. Cannot attach it to ${context.uid}.`
        );
      }
    }
  }
}

/**
 * ينشئ Document Service Middleware للتحقق من ملكية الملفات والمحتوى
 * 
 * @param {object} strapi - Strapi instance
 * @returns {Function} middleware function
 */
function createFileOwnershipMiddleware(strapi) {
  return async (context, next) => {
    // فقط على create و update
    if (!['create', 'update'].includes(context.action)) {
      return next();
    }

    // تجاهل upload plugin نفسه (لتجنب circular)
    if (context.uid === 'plugin::upload.file') {
      return next();
    }

    const data = context.params?.data;
    if (!data) return next();

    // الوصول للمستخدم الحالي
    const requestContext = strapi.requestContext.get();
    const userId = requestContext?.state?.user?.id;

    // لو لا يوجد مستخدم — العملية من admin أو internal
    if (!userId) return next();

    // اعثر على حقول media — لو لا يوجد media، لا حاجة لأي تحقق
    const mediaFields = findMediaFields(context.contentType?.attributes);
    if (mediaFields.length === 0) return next();

    // لو يوجد media في الـ data فقط → طبّق التحققات
    const hasMediaInData = mediaFields.some(
      (field) => extractFileIds(data[field]).length > 0
    );

    if (!hasMediaInData) return next();

    // ── Check 1: Content Ownership ──
    await validateContentOwnership(context, userId, strapi);

    // ── Check 2: File Ownership ──
    await validateFileOwnership(context, userId, strapi);

    return next();
  };
}

module.exports = {
  createFileOwnershipMiddleware,
  extractFileIds,
  findMediaFields,
  extractOwnerId,
  validateContentOwnership,
  validateFileOwnership,
  OWNER_FIELD,
};

