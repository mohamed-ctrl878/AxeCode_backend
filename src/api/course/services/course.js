'use strict';

/**
 * course service
 * Handles enrichment logic only.
 * Draft/Published is managed by Strapi core.
 */

const { createCoreService } = require('@strapi/strapi').factories;
const { CONTENT_TYPES } = require('../../entitlement/constants');

module.exports = createCoreService('api::course.course', ({ strapi }) => ({
  /**
   * Enriches course data with price, students, and access status via Facade
   * @param {object} course - Course document
   * @param {object|null} user - {id, documentId}
   */
  async enrichCourse(course, user = null) {
    if (!course) return null;
    
    const userId = user?.id || null;
    const userDocId = user?.documentId || null;

    const facade = strapi.service('api::entitlement.content-access-facade');
    
    // Unified Enrichment (Facade) - Pass numeric userId for access checks
    // getMetricsAndAccess compares against reg.users_permissions_user?.id (numeric) first,
    // so passing a string documentId causes a type mismatch and hasAccess always returns false.
    const metrics = await facade.getFullDetails(course.documentId, CONTENT_TYPES.COURSE, userId);

    const isPublisher = (userDocId && course.users_permissions_user?.documentId == userDocId) || 
                        (userId && course.users_permissions_user?.id == userId);

    const enriched = {
      ...course,
      price: metrics.price,
      student_count: metrics.studentCount,
      hasAccess: isPublisher || metrics.hasAccess,
      entitlementsId: metrics.entitlementId
    };

    // Interaction Metadata (Social Facade)
    const interactionFacade = strapi.service('api::rate.interaction-facade');
    const socialMetadata = await interactionFacade.getMetadata(CONTENT_TYPES.COURSE, course.documentId, userDocId || userId);

    // 3. User Progress Calculation & Lesson Tagging
    let completedLessonIds = [];
    
    if (userDocId) {
      try {
        // Query progress using strapi.documents (v5 standard)
        const progressRecords = await strapi.documents('api::user-progress.user-progress').findMany({
          filters: {
            users_permissions_user: { documentId: userDocId },
            course: { documentId: course.documentId },
            status: 'completed'
          },
          fields: ['id'],
          populate: {
            lesson: { fields: ['documentId'] }
          }
        });

        completedLessonIds = progressRecords
          .map(p => p.lesson?.documentId)
          .filter(Boolean);
      } catch (err) {
        console.error('[CourseEnrich] Progress fetch error:', err);
      }
    }

    // Prepare enriched weeks with isCompleted tags
    const result = {
      ...enriched,
      interactions: socialMetadata,
      completedLessonsCount: completedLessonIds.length
    };

    // Strip sensitive content AND inject isCompleted tags simultaneously 
    return this.processWeeksAndLessons(result, completedLessonIds);
  },

  /**
   * Combined logic for stripping sensitive data and tagging completion
   */
  processWeeksAndLessons(course, completedLessonIds) {
    if (!course.weeks) return course;

    const processedWeeks = course.weeks.map(week => ({
      ...week,
      lessons: week.lessons?.map(lesson => {
        // 1. Tag progress
        const updatedLesson = {
          ...lesson,
          isCompleted: completedLessonIds.includes(lesson.documentId)
        };

        // 2. Strip sensitive data if no access
        if (course.hasAccess || lesson.public) return updatedLesson;

        const { video, description, ...safeMeta } = updatedLesson;
        return safeMeta;
      })
    }));

    return {
      ...course,
      weeks: processedWeeks
    };
  },

  /**
   * Enriches an array of courses
   */
  async filterAndEnrichCourses(courses, user = null) {
    if (!courses || !Array.isArray(courses)) return [];
    return Promise.all(courses.map(course => this.enrichCourse(course, user)));
  }
}));
