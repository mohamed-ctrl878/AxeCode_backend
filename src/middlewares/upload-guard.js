'use strict';

/**
 * Upload Guard Middleware
 * 
 * يمنع الوصول المباشر لـ /uploads/* لأسباب أمنية.
 * الوصول للملفات يجب أن يكون فقط عبر /api/upload/files/:id
 */
module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    // Only intercept requests for files in the /uploads directory
    if (ctx.url.startsWith('/uploads/') || ctx.url.startsWith('/uploads\\')) {
      try {
        const userId = ctx.state?.user?.id;
        
        // 1. Find the file in the database by its URL
        // In Strapi, the 'url' field typically starts with /uploads/
        const file = await strapi.db.query('plugin::upload.file').findOne({
          where: { url: ctx.url },
          populate: ['owner', 'related'],
        });

        // 2. If the file is not in managed by Strapi (e.g. static asset in public/uploads), 
        // we might choose to allow it or block it. For now, we only protect DB-tracked files.
        if (!file) {
          return next();
        }

        // 3. Use the centralized access service to check permissions
        const accessService = strapi.service('api::upload-security.file-access');
        
        // If the service doesn't exist (maybe during migration), we fallback to blocked for safety
        if (!accessService) {
          ctx.status = 403;
          ctx.body = { error: 'Security service unavailable. Access denied.' };
          return;
        }

        const allowed = await accessService.canAccess(file, userId);

        if (allowed) {
          // Access granted — let Strapi handle serving the static file
          return next();
        }

        // Access denied — Block with a clean JSON error
        ctx.status = 403;
        ctx.body = {
          error: {
            status: 403,
            name: 'ForbiddenError',
            message: 'You do not have permission to access this file directly.',
          },
        };
        return;
      } catch (err) {
        strapi.log.error(`[UploadGuard] Error checking access for ${ctx.url}:`, err);
        ctx.status = 500;
        ctx.body = { error: 'Internal server error in security guard.' };
        return;
      }
    }
    
    // Not an upload request, proceed as normal
    await next();
  };
};
