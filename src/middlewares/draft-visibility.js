'use strict';

/**
 * Global Draft Visibility Middleware
 * Ensures content marked with isDraft: true is only returned if the requester is the publisher/owner.
 */

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    // Only apply to GET requests for our content types
    const path = ctx.fullPath || ctx.path;
    const isApiRequest = path.startsWith('/api/');
    
    // We only care about GET (find/findOne) requests to our core APIs
    if (!isApiRequest || ctx.method !== 'GET') {
      return await next();
    }

    // Extract pluralName from path (e.g., /api/courses/:id?populate=* -> courses)
    const segments = path.split('/').filter(Boolean); // [api, courses, id]
    const pluralName = segments[1]; 
    
    // Find the corresponding UID by pluralName
    const contentType = Object.values(strapi.contentTypes).find(
      (ct) => ct.info.pluralName === pluralName && ct.uid.startsWith('api::')
    );

    if (!contentType) {
      return await next();
    }

    const uid = contentType.uid;
    
    // Map of UIDs to their owner relation field names
    const ownerFields = {
      'api::course.course': 'users_permissions_user',
      'api::article.article': 'author',
      'api::blog.blog': 'publisher',
      'api::problem.problem': 'publisher',
      'api::roadmap.roadmap': 'author',
      'api::event.event': 'users_permissions_user',
      'api::lesson.lesson': 'users_permissions_user',
      'api::week.week': 'users_permissions_user',
    };

    const ownerField = ownerFields[uid];
    if (!ownerField) {
      return await next();
    }

    // Capture the current user from state (populated by auth middleware)
    const user = ctx.state.user;
    
    /**
     * Logic:
     * - Show if isDraft is false (or not set, though we have default: true now)
     * - OR Show if isDraft is true AND (User is Authenticated AND User.id matches Owner.id)
     */
    const draftFilter = {
      $or: [
        { isDraft: { $eq: false } }, 
        user ? { 
          $and: [
            { isDraft: { $eq: true } },
            { [ownerField]: { id: { $eq: user.id } } }
          ]
        } : null
      ].filter(Boolean)
    };

    // Inject filter into query
    if (!ctx.query.filters) {
      ctx.query.filters = {};
    }
    
    // Apply the filter using $and to preserve any user-provided filters
    if (Object.keys(ctx.query.filters).length > 0) {
      ctx.query.filters = {
        $and: [
          ctx.query.filters,
          draftFilter
        ]
      };
    } else {
      ctx.query.filters = draftFilter;
    }

    await next();
  };
};
