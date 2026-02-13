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

    // Initialize Socket.io
    const io = new Server(strapi.server.httpServer, {
      cors: {
        origin:"http://192.168.1.5:5173" ,//|| process.env.FRONTEND_URL || 'http://localhost:5173'
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    strapi.io = io;

    // Use specialized messenger service for WS logic
    strapi.service('api::conversation.messenger').initialize(io);
    
    // Initialize live stream socket handlers
    strapi.service('api::live-stream.live-stream-socket').initialize(io);
    
    // Initialize submission socket handlers
    strapi.service('api::submission.submission-socket').initialize(io);
    
    strapi.log.info('[Socket.io] WebSocket server initialized (messenger + live-stream + submission)');
  },
};
