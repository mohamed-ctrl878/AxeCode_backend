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
  async enrichCourse(course, userOrId = null) {
    if (!course) return null;
    
    // Support both numeric ID (legacy tests) and user object
    let userId = null;
    let userDocId = null;

    if (userOrId && typeof userOrId === 'object') {
      userId = userOrId.id;
      userDocId = userOrId.documentId;
    } else {
      userId = userOrId;
    }


    const facade = strapi.service('api::entitlement.content-access-facade');
    
    // Unified Enrichment (Facade) - Pass numeric userId for access checks
    // getMetricsAndAccess compares against reg.users_permissions_user?.id (numeric) first,
    // so passing a string documentId causes a type mismatch and hasAccess always returns false.
    const metrics = await facade.getFullDetails(course.documentId, CONTENT_TYPES.COURSE, userId);

    const isInstructor = !!(
      (userDocId && course.users_permissions_user?.documentId === userDocId) || 
      (userId && course.users_permissions_user?.id == userId)
    );

    const enriched = {
      ...course,
      price: metrics.price,
      student_count: metrics.studentCount,
      hasAccess: isInstructor || metrics.hasAccess,
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

    // 4. Total Lessons Count & Total Duration
    let totalLessonsCount = 0;
    let totalDuration = 0;
    try {
      const courseId = course.id;
      if (!courseId) {
          strapi.log.warn(`[CourseEnrich] Missing numeric ID for course enrichment`);
      } else {
        // Use DB Query Engine for direct relational join on numeric IDs (most reliable)
        const lessons = await strapi.db.query('api::lesson.lesson').findMany({
          where: {
            week: {
              course: courseId
            }
          },
          select: ['id', 'duration']
        });

        totalLessonsCount = lessons.length;
        totalDuration = lessons.reduce((acc, curr) => acc + (Number(curr.duration) || 0), 0);

        console.log(`[CourseEnrich] Course ID ${courseId}: Found ${totalLessonsCount} lessons via DB query.`);
      }
    } catch (err) {
      strapi.log.error('[CourseEnrich] Lesson metrics error:', err);
    }

    // Prepare enriched weeks with isCompleted tags
    const result = {
      ...enriched,
      interactions: socialMetadata,
      completedLessonsCount: completedLessonIds.length,
      lessonCount: totalLessonsCount,
      duration: totalDuration
    };

    // Strip sensitive content AND inject isCompleted tags simultaneously 
    return this.processWeeksAndLessons(result, completedLessonIds);
  },

  /**
   * Alias for test compatibility and clean content stripping
   */
  stripSensitiveContent(course) {
    return this.processWeeksAndLessons(course, []);
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
