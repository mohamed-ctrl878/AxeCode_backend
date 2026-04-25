'use strict';

/**
 * Controller: cms-analytics
 * Orchestrates the collection of symmetrical metrics for the Insight Hub.
 */
module.exports = {
  async fetchAll(ctx) {
    try {
      const service = strapi.service('api::cms-analytics.cms-analytics');
      
      // Dynamic time range from query (default to 60 days)
      const days = parseInt(ctx.query.days) || 60;

      const [users, courses, events, reports, authors, organizers] = await Promise.all([
        service.getResourceMetrics('plugin::users-permissions.user', days),
        service.getResourceMetrics('api::course.course', days),
        service.getResourceMetrics('api::event.event', days),
        service.getResourceMetrics('api::report.report', days, { review_status: 'pending' }),
        service.getContributorMetrics('api::course.course', 'users_permissions_user', days),
        service.getContributorMetrics('api::event.event', 'users_permissions_user', days),
      ]);

      ctx.body = {
        data: {
          users,
          courses,
          events,
          reports,
          contributors: {
            authors,
            organizers,
          },
        },
      };
    } catch (err) {
      strapi.log.error('[Analytics] Fetch Error:', err);
      ctx.badRequest('Analytics fetch failed', { error: err.message });
    }
  }
};
