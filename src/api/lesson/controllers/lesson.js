'use strict';

/**
 * lesson controller
 * الدروس يتم الوصول إليها من خلال الـ Course endpoint
 * ما عدا الناشر يمكنه الوصول لدروسه مباشرة
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::lesson.lesson', ({ strapi }) => ({
  
  // POST /lessons - Create a new lesson
  async create(ctx) {
    // التحقق من المصادقة
    if (!ctx.state.user) {
      return ctx.unauthorized('Not authenticated. Please login first.');
    }

    const { data } = ctx.request.body;

    if (!data) {
      return ctx.badRequest('Data is required');
    }

    // Set the user and ensure the lesson is published immediately
    ctx.request.body.data = {
      ...data,
      users_permissions_user: ctx.state.user.id,
      publishedAt: new Date(),
    };

    return await super.create(ctx);
  },

  // GET /lessons - جلب الدروس المتاحة للمستخدم (صاحب الدرس، محتوى مجاني، أو مشترك في الكورس)
  async find(ctx) {
    const user = ctx.state.user;
    const userId = user?.id || null;
    const userDocId = user?.documentId || null;

    // 1. بناء الفلتر بناءً على الصلاحيات
    let accessFilters = [];

    // الدروس العامة المنشورة متاحة للجميع
    accessFilters.push({
      $and: [
        { public: true },
        { publishedAt: { $not: null } }
      ]
    });

    if (user) {
      // دروس الناشر (يستطيع رؤية المسودات الخاصة به أيضاً)
      accessFilters.push({ users_permissions_user: { id: userId } });

      // الدروس المنشورة في الكورسات المشترك بها المستخدم
      try {
        const registrations = await strapi.documents('api::user-entitlement.user-entitlement').findMany({
          filters: {
            users_permissions_user: { id: userId },
            content_types: 'course',
            valid: 'successed'
          },
          fields: ['productId']
        });

        const productIds = registrations.map(r => r.productId).filter(Boolean);
        
        if (productIds.length > 0) {
          const entitlements = await strapi.documents('api::entitlement.entitlement').findMany({
            filters: { 
              documentId: { $in: productIds },
              content_types: 'course'
            },
            fields: ['itemId']
          });

          const entitledCourseIds = entitlements.map(e => e.itemId).filter(Boolean);

          if (entitledCourseIds.length > 0) {
            accessFilters.push({
              $and: [
                { week: { course: { documentId: { $in: entitledCourseIds } } } },
                { publishedAt: { $not: null } }
              ]
            });
          }
        }
      } catch (err) {
        strapi.log.error('[LessonController] Entitlement fetch error:', err.message);
      }
    }

    // دمج الفلاتر مع الاستعلام الحالي
    ctx.query.filters = {
      ...ctx.query.filters,
      $or: accessFilters
    };

    const response = await super.find(ctx);
    if (!response || !response.data) return response;

    const enriched = await Promise.all(
      response.data.map(async (lesson) => {
        const isOwner = userDocId && lesson.users_permissions_user?.documentId === userDocId;
        return strapi.service('api::lesson.lesson').enrichLesson(lesson, userDocId || userId);
      })
    );

    return ctx.send({
      data: enriched,
      meta: response.meta
    });
  },

  // GET /lessons/:id - الحصول على درس واحد بناءً على الصلاحيات
  async findOne(ctx) {
    const user = ctx.state.user;
    const { id } = ctx.params;
    const userId = user?.id || null;
    const userDocId = user?.documentId || null;

    // 1. Prepare population: Merge user request with security requirements
    let population = {};
    if (ctx.query.populate === '*') {
      // Manual expansion of '*' to avoid "Invalid key *" error in Strapi v5 document service
      population = {
        video: true,
        users_permissions_user: { fields: ['id', 'documentId'] },
        week: {
          populate: {
            course: { fields: ['id', 'documentId'] }
          }
        }
      };
    } else {
      population = {
        ...(ctx.query.populate || {}),
        users_permissions_user: { fields: ['id', 'documentId'] },
        week: {
          populate: {
            course: { fields: ['id', 'documentId'] }
          }
        }
      };
    }

    const fetchParams = {
      documentId: id,
      populate: population
    };

    // 1. Try fetching the published version first
    let lesson = await strapi.documents('api::lesson.lesson').findOne({
      ...fetchParams,
      status: 'published'
    });

    // 2. If it's a publisher, they might want to see the latest draft
    // Or if it's not published yet, we need the draft to check ownership
    if (!lesson || (userDocId && lesson.users_permissions_user?.documentId === userDocId)) {
      const draftVersion = await strapi.documents('api::lesson.lesson').findOne({
        ...fetchParams,
        status: 'draft'
      });

      if (draftVersion) {
        const isDraftOwner = userDocId && draftVersion.users_permissions_user?.documentId === userDocId;
        // If we found a draft and the user owns it, prefer the draft content
        if (isDraftOwner) {
          lesson = draftVersion;
        } else if (!lesson) {
          // If no published version and user doesn't own the draft
          return ctx.notFound('Lesson is not published yet');
        }
      }
    }

    if (!lesson) {
      return ctx.notFound('Lesson not found');
    }

    // 3. Ownership / Publisher check
    const isOwner = userDocId && lesson.users_permissions_user?.documentId === userDocId;
    if (isOwner) {
      const enriched = await strapi.service('api::lesson.lesson').enrichLesson(lesson, userDocId || userId);
      return ctx.send({ data: enriched, meta: { isPublisher: true } });
    }

    // 4. Public check
    if (lesson.public === true) {
      const enriched = await strapi.service('api::lesson.lesson').enrichLesson(lesson, userDocId || userId);
      return ctx.send({ data: enriched });
    }

    // 5. Entitlement check (Student)
    if (user) {
      try {
        const courseId = lesson.week?.course?.documentId;
        if (courseId) {
          const { hasAccess } = await strapi.service('api::entitlement.entitlement')
            .getMetricsAndAccess(courseId, 'course', userId);
          
          if (hasAccess) {
            const enriched = await strapi.service('api::lesson.lesson').enrichLesson(lesson, userDocId || userId);
            return ctx.send({ data: enriched });
          }
        }
      } catch (err) {
        strapi.log.error('[LessonController] Entitlement verification error:', err.message);
      }
    }

    return ctx.forbidden('You do not have access to this lesson. Please enroll in the course.');
  },
}));
