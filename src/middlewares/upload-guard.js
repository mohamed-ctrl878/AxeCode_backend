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
        let userId = ctx.state?.user?.id;
        
        // Manual verification for static files where Strapi's auth pipeline doesn't run
        if (!userId) {
          const authHeader = ctx.request.header.authorization;
          let token;

          if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
          } else if (ctx.cookies.get('jwt')) {
            token = ctx.cookies.get('jwt');
          }

          if (token) {
            try {
              const { id } = await strapi.plugins['users-permissions'].services.jwt.verify(token);
              userId = id;
            } catch (err) {
              // Invalid token, ignore and proceed as guest
            }
          }
        }
        
        // 1. Find the file in the database by its URL
        // In Strapi, the 'url' field typically starts with /uploads/
        const file = await strapi.db.query('plugin::upload.file').findOne({
          where: { url: ctx.url },
          populate: ['owner', 'related'],
        });

        // 2. Security Policy:
        // All files in /uploads/ must be managed by Strapi's database.
        // If a file exists on disk but not in the DB, it's considered unmanaged/orphaned and blocked by default.
        if (!file) {
          ctx.status = 403;
          ctx.body = {
            error: {
              status: 403,
              name: 'ForbiddenError',
              message: 'You do not have permission to access this file directly.',
            },
          };
          return;
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
