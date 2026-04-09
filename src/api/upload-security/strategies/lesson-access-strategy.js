'use strict';

/**
 * Lesson Access Strategy
 * 
 * يحدد هل المستخدم يحق له الوصول لملفات الـ Lesson.
 * 
 * المنطق:
 * 1. هل المستخدم هو مالك الـ Lesson؟ → ✅
 * 2. هل الـ Lesson مربوط بـ Week؟ → لو لا ❌
 * 3. هل الـ Week مربوط بـ Course؟ → لو لا ❌ 
 * 4. هل المستخدم هو مالك الـ Course؟ → لو نعم ✅، لو لا ❌
 * 
 * @module lesson-access-strategy
 */

/**
 * ينشئ strategy function للـ Lesson
 * 
 * @param {object} strapi - Strapi instance
 * @returns {Function} async (documentId, userId) => boolean
 */
function createLessonAccessStrategy(strapi) {
  /**
   * @param {string} documentId - documentId الـ Lesson
   * @param {number} userId - ID المستخدم الطالب الوصول
   * @returns {Promise<boolean>}
   */
  return async function lessonAccessStrategy(documentId, userId) {
    if (!documentId) return false;

    // ── Step 1: Fetch lesson with week → course → owner chain ──
    const lesson = await strapi.db.query('api::lesson.lesson').findOne({
      where: { documentId },
      populate: {
        users_permissions_user: true,
        week: {
          populate: {
            course: {
              populate: {
                users_permissions_user: true,
              },
            },
          },
        },
      },
    });

    if (!lesson) return false;

    // ── Step 2: هل الدرس عام (Public)؟ ──
    // إذا كان الدرس عاماً، نسمح بالوصول للجميع حتى بدون تسجيل دخول
    if (lesson.public === true) {
      return true;
    }

    // إذا كان الدرس خاصاً، فيجب وجود مستخدم
    if (!userId) return false;

    // ── Step 2: هل المستخدم هو مالك الـ Lesson؟ ──
    const lessonOwnerId = lesson.users_permissions_user?.id;
    if (lessonOwnerId && lessonOwnerId === userId) {
      return true;
    }

    // ── Step 3: هل الـ Lesson مربوط بـ Week؟ ──
    const week = lesson.week;
    if (!week) return false;

    // ── Step 4: هل الـ Week مربوط بـ Course؟ ──
    const course = week.course;
    if (!course) return false;

    // ── Step 5: هل المستخدم هو مالك الـ Course؟ ──
    const courseOwnerId = course.users_permissions_user?.id;
    if (courseOwnerId && courseOwnerId === userId) {
      return true;
    }

    // ── Step 6: هل المستخدم مشترك في الكورس (Enrollment)؟ ──
    const accessFacade = strapi.service('api::entitlement.content-access-facade');
    if (accessFacade && course.documentId) {
      const { hasAccess } = await accessFacade.getFullDetails(course.documentId, 'course', userId);
      if (hasAccess) return true;
    }

    return false;
  };
}

module.exports = { createLessonAccessStrategy };
