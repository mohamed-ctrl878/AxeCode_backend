'use strict';

const { Server } = require('socket.io');
const { createFileOwnershipMiddleware } = require('./middlewares/file-ownership-middleware');
const { createLessonAccessStrategy } = require('./api/upload-security/strategies/lesson-access-strategy');
const { createAuthenticatedAccessStrategy } = require('./api/upload-security/strategies/authenticated-access-strategy');

module.exports = {
  register({ strapi }) {
    // ── Layer 1: Extend upload file schema with owner field ──
    strapi.contentType('plugin::upload.file').attributes.owner = {
      type: 'relation',
      relation: 'manyToOne',
      target: 'plugin::users-permissions.user',
      configurable: false,
    };

    // ── Layer 2: Document Service Middleware — file ownership validation ──
    strapi.documents.use(createFileOwnershipMiddleware(strapi));

    strapi.log.info('[Upload Security] Owner field extended + File Ownership Middleware registered');
  },

  bootstrap({ strapi }) {
    // ── Layer 4: Register Access Strategies ──
    const registry = strapi.service('api::upload-security.access-strategy-registry');
    registry.register('api::lesson.lesson', createLessonAccessStrategy(strapi));

    // Authenticated-only access — أي مستخدم مصادق يحق له الوصول
    const authStrategy = createAuthenticatedAccessStrategy();
    registry.register('api::article.article', authStrategy);
    registry.register('api::blog.blog', authStrategy);
    registry.register('api::comment.comment', authStrategy);
    registry.register('api::course.course', authStrategy);  // صورة الكورس
    registry.register('api::event.event', authStrategy);
    registry.register('plugin::users-permissions.user', authStrategy);  // avatar

    strapi.log.info('[Upload Security] All access strategies registered');
    
    // ── Layer 5: Make upload.findOne public to allow <img> tags to work ──
    // We rely on our custom findOne override for actual security logic.
    (async () => {
      try {
        const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
          where: { type: 'public' },
        });

        if (publicRole) {
          await strapi.db.query('plugin::users-permissions.permission').create({
            data: {
              action: 'plugin::upload.content-api.findOne',
              role: publicRole.id,
            },
          });
          strapi.log.info('[Upload Security] Public access granted to upload.findOne (secured by custom logic)');
        }
      } catch (err) {
        // Permission might already exist, ignore errors
      }
    })();

    // ── Layer 6: Grant GitHub OAuth permissions to Public + Authenticated roles ──
    // Strapi only auto-creates these on fresh DBs. Existing projects need them explicitly.
    // IMPORTANT: jwt-cookie middleware authenticates users on ALL requests, so the
    // Authenticated role also needs connect/callback permissions for OAuth to work.
    (async () => {
      try {
        const roles = await strapi.db.query('plugin::users-permissions.role').findMany({
          where: { type: { $in: ['public', 'authenticated'] } },
        });

        const oauthActions = [
          'plugin::users-permissions.auth.connect',
          'plugin::users-permissions.auth.callback',
        ];

        for (const role of roles) {
          for (const action of oauthActions) {
            const exists = await strapi.db.query('plugin::users-permissions.permission').findOne({
              where: { action, role: role.id },
            });

            if (!exists) {
              await strapi.db.query('plugin::users-permissions.permission').create({
                data: { action, role: role.id },
              });
              strapi.log.info(`[OAuth] Permission granted to ${role.type}: ${action}`);
            }
          }

          // ONLY grant user.me to Authenticated role
          if (role.type === 'authenticated') {
            const meAction = 'plugin::users-permissions.user.me';
            const meExists = await strapi.db.query('plugin::users-permissions.permission').findOne({
              where: { action: meAction, role: role.id },
            });

            if (!meExists) {
              await strapi.db.query('plugin::users-permissions.permission').create({
                data: { action: meAction, role: role.id },
              });
              strapi.log.info(`[OAuth] Permission granted to ${role.type}: ${meAction}`);
            }
          }
        }
      } catch (err) {
        strapi.log.warn(`[OAuth] Permission grant skipped: ${err.message}`);
      }
    })();

    // Initialize Socket.io
    const io = new Server(strapi.server.httpServer, {
      cors: {
        origin: [
          'https://axe-code.vercel.app',
          process.env.FRONTEND_URL || 'http://localhost:5173',
        ].filter(Boolean),
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    strapi.io = io;

    // Initialize submission socket handlers
    strapi.service('api::submission.submission-socket').initialize(io);
    
    // Initialize notification socket handlers
    strapi.service('api::notification.notification-socket').initialize(io);
    
    strapi.log.info('[Socket.io] WebSocket server initialized (submission + notification)');
  },
};
