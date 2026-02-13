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
   */
  async enrichCourse(course, userId) {
    if (!course) return null;
    const facade = strapi.service('api::entitlement.content-access-facade');
    
    // Unified Enrichment (Facade)
    const metrics = await facade.getFullDetails(course.documentId, CONTENT_TYPES.COURSE, userId);

    const isPublisher = userId && (
      course.users_permissions_user?.id == userId || 
      course.users_permissions_user?.documentId == userId
    );

    const enriched = {
      ...course,
      price: metrics.price,
      student_count: metrics.studentCount,
      hasAccess: isPublisher || metrics.hasAccess,
      entitlementsId: metrics.entitlementId
    };

    // Interaction Metadata (Social Facade)
    const interactionFacade = strapi.service('api::rate.interaction-facade');
    const socialMetadata = await interactionFacade.getMetadata(CONTENT_TYPES.COURSE, course.documentId, userId);

    const result = {
      ...enriched,
      interactions: socialMetadata
    };

    // Strip sensitive content for non-entitled users
    return this.stripSensitiveContent(result);
  },

  /**
   * Strips video and description from paid (non-public) lessons
   * when the user does NOT have access to the course.
   * 
   * @param {object} course - Enriched course with hasAccess flag
   * @returns {object} Course with sensitive content removed if needed
   */
  stripSensitiveContent(course) {
    // Publisher or entitled user — full access
    if (course.hasAccess) return course;
    // No nested content to strip
    if (!course.weeks) return course;

    return {
      ...course,
      weeks: course.weeks.map(week => ({
        ...week,
        lessons: week.lessons?.map(lesson => {
          // Free (public) lesson — keep everything
          if (lesson.public) return lesson;

          // Paid (private) lesson — remove sensitive content
          const { video, description, ...safeMeta } = lesson;
          return safeMeta;
        })
      }))
    };
  },

  /**
   * Enriches an array of courses
   */
  async filterAndEnrichCourses(courses, userId) {
    if (!courses || !Array.isArray(courses)) return [];
    return Promise.all(courses.map(course => this.enrichCourse(course, userId)));
  }
}));
