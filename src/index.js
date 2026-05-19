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
    
    // ── Layer 7: isDraft Migration ──
    // This script ensures legacy records are marked as NOT drafts (isDraft: false)
    // to maintain visibility after disabling draftAndPublish.
    (async () => {
      try {
        const fs = require('fs');
        const path = require('path');
        const lockFile = path.join(process.cwd(), '.migration_draft_done');
        
        if (fs.existsSync(lockFile)) return;

        const entities = [
          'api::article.article',
          'api::blog.blog',
          'api::course.course',
          'api::event.event',
          'api::lesson.lesson',
          'api::problem.problem',
          'api::roadmap.roadmap',
          'api::week.week',
        ];

        strapi.log.info('[Migration] Starting isDraft migration for existing records...');

        for (const uid of entities) {
          try {
            const result = await strapi.db.query(uid).updateMany({
              where: { isDraft: null },
              data: { isDraft: false },
            });
            strapi.log.info(`[Migration] Updated ${result?.count || 0} records for ${uid}`);
          } catch (err) {
            strapi.log.error(`[Migration] Failed to migrate ${uid}: ${err.message}`);
          }
        }

        fs.writeFileSync(lockFile, new Date().toISOString());
        strapi.log.info('[Migration] isDraft migration completed manually via lock file.');
      } catch (globalErr) {
        strapi.log.error(`[Migration] Global error in Draft Migration: ${globalErr.message}`);
      }
    })();

    // ── Layer 8: Platform Wallet Bootstrap ──
    // Creates the platform wallet (for collecting commissions) if it doesn't exist.
    (async () => {
      try {
        const existing = await strapi.db.query('api::wallet.wallet').findOne({
          where: { owner_type: 'platform' },
        });

        if (!existing) {
          await strapi.db.query('api::wallet.wallet').create({
            data: {
              owner_type: 'platform',
              balance: 0,
              pending_balance: 0,
              version: 0,
              currency: 'EGP',
              commission_rate: 0,
              is_active: true,
            },
          });
          strapi.log.info('[Wallet] ✅ Platform wallet created successfully');
        } else {
          strapi.log.info('[Wallet] Platform wallet already exists');
        }
      } catch (err) {
        strapi.log.warn(`[Wallet] Platform wallet init skipped: ${err.message}`);
      }
    })();

    // ── Layer 9: Job Title Tag Seeding ──
    // Seeds the initial fixed job title tags for the Project Management feature.
    (async () => {
      try {
        const fs = require('fs');
        const path = require('path');
        const lockFile = path.join(process.cwd(), '.migration_job_title_tags_done');

        if (fs.existsSync(lockFile)) return;

        const initialTags = [
          { slug: 'frontend-developer', label_ar: 'مطور واجهات أمامية', label_en: 'Frontend Developer', category: 'Frontend' },
          { slug: 'backend-developer', label_ar: 'مطور خوادم', label_en: 'Backend Developer', category: 'Backend' },
          { slug: 'full-stack-developer', label_ar: 'مطور متكامل', label_en: 'Full Stack Developer', category: 'Full Stack' },
          { slug: 'mobile-developer', label_ar: 'مطور تطبيقات جوال', label_en: 'Mobile Developer', category: 'Mobile' },
          { slug: 'devops-engineer', label_ar: 'مهندس DevOps', label_en: 'DevOps Engineer', category: 'DevOps' },
          { slug: 'qa-engineer', label_ar: 'مهندس ضمان الجودة', label_en: 'QA Engineer', category: 'QA' },
          { slug: 'ui-ux-designer', label_ar: 'مصمم واجهات', label_en: 'UI/UX Designer', category: 'Design' },
          { slug: 'product-manager', label_ar: 'مدير منتج', label_en: 'Product Manager', category: 'Management' },
          { slug: 'tech-lead', label_ar: 'قائد تقني', label_en: 'Tech Lead', category: 'Management' },
          { slug: 'data-engineer', label_ar: 'مهندس بيانات', label_en: 'Data Engineer', category: 'Data' },
        ];

        strapi.log.info('[JobTitleTag] Seeding initial job title tags...');

        for (const tag of initialTags) {
          const exists = await strapi.db.query('api::job-title-tag.job-title-tag').findOne({
            where: { slug: tag.slug },
          });

          if (!exists) {
            await strapi.db.query('api::job-title-tag.job-title-tag').create({
              data: { ...tag, is_active: true },
            });
          }
        }

        fs.writeFileSync(lockFile, new Date().toISOString());
        strapi.log.info('[JobTitleTag] ✅ Initial job title tags seeded successfully');
      } catch (err) {
        strapi.log.warn(`[JobTitleTag] Seed skipped: ${err.message}`);
      }
    })();

    // ── Layer 10: Project Management API Permissions ──
    // Grants public access to job-title-tags list and authenticated access
    // to all project management endpoints.
    (async () => {
      try {
        const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
          where: { type: 'public' },
        });
        const authRole = await strapi.db.query('plugin::users-permissions.role').findOne({
          where: { type: 'authenticated' },
        });

        // Public actions (no auth needed)
        const publicActions = [
          'api::job-title-tag.job-title-tag.find',
          'api::project.project.find',
          'api::project.project.findOne',
          'api::project-role.project-role.findRoles',
          'api::project-member.project-member.findMembers',
          'api::sprint.sprint.findSprints',
          'api::task.task.findTasks',
          'api::github-event.github-event.ingest',
          'api::github-event.github-event.findByProject',
        ];

        // Authenticated actions (user must be logged in)
        const authActions = [
          'api::user-job-title.user-job-title.getMyJobTitles',
          'api::user-job-title.user-job-title.addMyJobTitle',
          'api::user-job-title.user-job-title.removeMyJobTitle',
          'api::project.project.find',
          'api::project.project.findOne',
          'api::project.project.create',
          'api::project.project.update',
          'api::project.project.delete',
          'api::project-role.project-role.findRoles',
          'api::project-role.project-role.createRole',
          'api::project-role.project-role.updateRole',
          'api::project-member.project-member.findMembers',
          'api::project-member.project-member.removeMember',
          'api::project-application.project-application.apply',
          'api::project-application.project-application.invite',
          'api::project-application.project-application.respond',
          'api::project-application.project-application.findByProject',
          'api::project-application.project-application.myApplications',
          'api::sprint.sprint.findSprints',
          'api::sprint.sprint.createSprint',
          'api::sprint.sprint.updateSprint',
          'api::sprint.sprint.startSprint',
          'api::task.task.findTasks',
          'api::task.task.createTask',
          'api::task.task.updateTask',
          'api::task.task.transitionTask',
          'api::task.task.reorderTasks',
          'api::task.task.deleteTask',
          'api::recommendation.recommendation.getJobAds',
        ];

        const grantPermission = async (action, roleId) => {
          const exists = await strapi.db.query('plugin::users-permissions.permission').findOne({
            where: { action, role: roleId },
          });
          if (!exists) {
            await strapi.db.query('plugin::users-permissions.permission').create({
              data: { action, role: roleId },
            });
          }
        };

        if (publicRole) {
          for (const action of publicActions) {
            await grantPermission(action, publicRole.id);
          }
          // Also grant public actions to authenticated role
          for (const action of publicActions) {
            if (authRole) await grantPermission(action, authRole.id);
          }
        }

        if (authRole) {
          for (const action of authActions) {
            await grantPermission(action, authRole.id);
          }
        }

        strapi.log.info('[ProjectMgmt] ✅ API permissions configured');
      } catch (err) {
        strapi.log.warn(`[ProjectMgmt] Permission setup skipped: ${err.message}`);
      }
    })();
  },
};
