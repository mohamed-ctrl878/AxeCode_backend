'use strict';

/**
 * Upload Plugin Extension
 * 
 * يعدّل سلوك plugin::upload لإضافة:
 * 1. تسجيل owner عند الرفع
 * 2. حماية findOne بفحص الملكية وربط المحتوى
 */

module.exports = (plugin) => {
  // حفظ controllers الأصلية
  const originalContentApiController = plugin.controllers['content-api'];

  // Override content-api controller
  plugin.controllers['content-api'] = (ctx) => {
    const original = originalContentApiController(ctx);

    return {
      ...original,

      /**
       * Override upload — يسجّل owner تلقائياً
       */
      async upload(koaCtx) {
        const userId = koaCtx.state?.user?.id;

        // نفّذ الرفع الأصلي
        await original.upload(koaCtx);

        // بعد الرفع — سجّل الـ owner على الملفات الجديدة
        if (userId && koaCtx.body) {
          const files = Array.isArray(koaCtx.body) ? koaCtx.body : [koaCtx.body];
          
          for (const file of files) {
            if (file?.id) {
              await ctx.strapi.db.query('plugin::upload.file').update({
                where: { id: file.id },
                data: { owner: userId },
              });
            }
          }
        }
      },

      /**
       * Override uploadFiles — يسجّل owner تلقائياً
       */
      async uploadFiles(koaCtx) {
        const userId = koaCtx.state?.user?.id;

        await original.uploadFiles(koaCtx);

        if (userId && koaCtx.body) {
          const files = Array.isArray(koaCtx.body) ? koaCtx.body : [koaCtx.body];

          for (const file of files) {
            if (file?.id) {
              await ctx.strapi.db.query('plugin::upload.file').update({
                where: { id: file.id },
                data: { owner: userId },
              });
            }
          }
        }
      },

      /**
       * Override findOne — حماية الوصول للملفات
       * 
       * Logic:
       * 1. هل المستخدم هو الـ owner؟ → ✅
       * 2. هل الملف مربوط بمحتوى (related)؟
       *    - لا → ❌ error
       *    - نعم → Access Strategy Registry
       */
      async findOne(koaCtx) {
        const userId = koaCtx.state?.user?.id;
        const { id } = koaCtx.params;

        // 1. Fetch file with related and owner
        const file = await ctx.strapi.db.query('plugin::upload.file').findOne({
          where: { id },
          populate: ['owner', 'related'],
        });

        if (!file) {
          koaCtx.status = 404;
          koaCtx.body = { error: { status: 404, message: 'File not found.' } };
          return;
        }

        // 2. Use centralized access service
        const accessService = ctx.strapi.service('api::upload-security.file-access');
        const allowed = await accessService.canAccess(file, userId);

        if (!allowed) {
          koaCtx.status = 403;
          koaCtx.body = { error: { status: 403, message: 'Access denied by security policy.' } };
          return;
        }

        // Helper function to serve the actual binary file
        const serveFile = (fileToServe) => {
          try {
            const fs = require('fs');
            const path = require('path');
            const publicPath = ctx.strapi.dirs?.public || 
                               ctx.strapi.dirs?.static?.public || 
                               path.join(process.cwd(), 'public');
            
            const filePath = path.join(publicPath, fileToServe.url);

            if (fs.existsSync(filePath)) {
              koaCtx.set('Content-Type', fileToServe.mime);
              koaCtx.set('Content-Disposition', `inline; filename="${fileToServe.name}"`);
              koaCtx.body = fs.createReadStream(filePath);
              return true;
            } else {
              ctx.strapi.log.warn(`[UploadSecurity] File NOT found at: ${filePath}`);
              return false;
            }
          } catch (err) {
            ctx.strapi.log.error('Error in serveFile helper:', err);
            return false;
          }
        };

        // Access granted — Serve the actual file stream
        if (serveFile(file)) return;
        return original.findOne(koaCtx);
      },
    };
  };

  return plugin;
};
