'use strict';

/**
 * user-entitlement controller
 * SOLID: Controller handles HTTP, enrichment logic is encapsulated
 */

const { createCoreController } = require('@strapi/strapi').factories;

const { CONTENT_TYPES } = require('../../entitlement/constants');

module.exports = createCoreController('api::user-entitlement.user-entitlement', ({ strapi }) => {
  const getFacade = () => strapi.service('api::entitlement.content-access-facade');

  /**
   * Helper: Verifies if a user owns the content associated with a product (entitlement).
   * DRY & Secure.
   */
  const verifyOwnership = async (productId, userId) => {
    const entitlement = await strapi.documents('api::entitlement.entitlement').findOne({
      documentId: productId
    });

    if (!entitlement) return { error: 'notFound', message: 'Product (Entitlement) not found' };
    console.debug("entitlement", entitlement)
    const contentTypeMap = {
      'course': 'api::course.course',
      'event': 'api::event.event',
      'uplive': 'api::live-stream.live-stream'
    };
    const targetApi = contentTypeMap[entitlement.content_types] || `api::${entitlement.content_types}.${entitlement.content_types}`;

    const item = await strapi.documents(targetApi).findOne({
      documentId: entitlement.itemId,
      populate: ['users_permissions_user']
    });
    console.debug("item", item)

    if (!item) return { error: 'notFound', message: 'Associated content item not found' };

    const isOwner = item.users_permissions_user?.id === userId;
    return { authorized: isOwner, entitlement, item };
  };

  return {
    async create(ctx) {
      if (!ctx.state.user) return ctx.unauthorized('Not authenticated');

      const body = ctx.request?.body?.data || ctx.request?.body || {};
      const { productId, content_types, users_permissions_user: targetUserId } = body;

      if (!productId || !content_types) return ctx.badRequest('productId and content_types are required');

      // 1. Ownership Check (Is this a manual grant by the owner?)
      const { authorized, entitlement, error, message } = await verifyOwnership(productId, ctx.state.user.id);

      if (error === 'notFound') return ctx.notFound(message);

      // Ownership check for Granting (Teachers/Owners)
      const isManualGrant = authorized;

      // If not the owner, check if the student is enrolling themselves in a free course
      if (!isManualGrant) {
        const isSelfEnrollment = (targetUserId === ctx.state.user.id || !targetUserId);
        const isFree = parseFloat(String(entitlement.price || 0)) === 0;

        if (!isSelfEnrollment) return ctx.forbidden('Access denied: Only the content owner can grant access to others');
        if (!isFree) return ctx.badRequest('This product requires payment for self-enrollment');
      }

      // 2. Check existence for the TARGET user
      const finalTargetUserId = targetUserId || ctx.state.user.id;
      const existing = await strapi.db.query("api::user-entitlement.user-entitlement").findOne({
        where: { productId, users_permissions_user: finalTargetUserId, content_types }
      });
      if (existing) return ctx.badRequest("Target user already has this content!");

      // 3. Create record
      const userEntitlement = await strapi.documents('api::user-entitlement.user-entitlement').create({
        data: {
          productId,
          users_permissions_user: finalTargetUserId,
          duration: entitlement.duration,
          strart: new Date().toISOString(),
          content_types,
          valid: 'successed'
        },
        status: 'published',
      });

      const enriched = await getFacade().getFullDetails(entitlement.itemId, content_types, finalTargetUserId);

      return ctx.send({
        message: 'Success',
        data: { ...userEntitlement, content: enriched }
      });
    },

    async findOne(ctx) {
      if (!ctx.state.user) return ctx.unauthorized('Not authenticated');
      const { id } = ctx.params;

      const userEntitlement = await strapi.documents('api::user-entitlement.user-entitlement').findOne({
        documentId: id,
        populate: ['users_permissions_user']
      });

      if (!userEntitlement) return ctx.notFound('Not found');
      if (userEntitlement.users_permissions_user?.id !== ctx.state.user.id) return ctx.forbidden();

      const entitlements = await strapi.documents('api::entitlement.entitlement').findMany({
        filters: { documentId: userEntitlement.productId }
      });
      const entitlement = entitlements[0];

      let content = null;
      if (entitlement) {
        content = await getFacade().getFullDetails(entitlement.itemId, entitlement.content_types, ctx.state.user.id);
      }

      return ctx.send({ data: { ...userEntitlement, content } });
    },

    async find(ctx) {
      if (!ctx.state.user) return ctx.unauthorized('Not authenticated');

      const queryParams = ctx.query || {};
      const filters = queryParams.filters || {};
      const populate = queryParams.populate;
      const productId = filters.productId?.$eq || filters.productId;

      // Case A: Owner viewing subscribers for a specific product
      if (productId) {
        const { authorized, entitlement, error, message } = await verifyOwnership(productId, ctx.state.user.id);
        if (error === 'notFound') return ctx.notFound(message);
        if (!authorized) return ctx.forbidden('Access denied: You are not the owner of this content');

        const userEntitlements = await strapi.documents('api::user-entitlement.user-entitlement').findMany({
          filters: {
            ...filters,
            productId: productId
          },
          populate: populate || ['users_permissions_user']
        });

        const data = await Promise.all(userEntitlements.map(async (ue) => {
          const content = await getFacade().getFullDetails(entitlement.itemId, entitlement.content_types, ctx.state.user.id);
          return { ...ue, content };
        }));

        return ctx.send({ data });
      }

      // Case B: Student viewing their own purchased content
      const userEntitlements = await strapi.documents('api::user-entitlement.user-entitlement').findMany({
        filters: {
          users_permissions_user: ctx.state.user.id
        },
        populate: populate || ['users_permissions_user']
      });

      const data = await Promise.all(userEntitlements.map(async (ue) => {
        // We need to find the related entitlement to get the itemId
        const entitlements = await strapi.documents('api::entitlement.entitlement').findMany({
          filters: { documentId: ue.productId }
        });
        const entitlement = entitlements[0];

        if (!entitlement) return { ...ue, content: null, targetDocumentId: null };

        const content = await getFacade().getFullDetails(entitlement.itemId, entitlement.content_types, ctx.state.user.id);
        return { ...ue, content, targetDocumentId: entitlement.itemId };
      }));

      return ctx.send({ data });
    },

    async delete(ctx) {
      if (!ctx.state.user) return ctx.unauthorized('Not authenticated');
      const { id } = ctx.params;

      const userEntitlement = await strapi.documents('api::user-entitlement.user-entitlement').findOne({
        documentId: id
      });

      if (!userEntitlement) return ctx.notFound('Enrollment record not found');

      // Ownership Check via Helper
      const { authorized, error, message } = await verifyOwnership(userEntitlement.productId, ctx.state.user.id);

      if (error === 'notFound') return ctx.notFound(message);
      if (!authorized) return ctx.forbidden('Access denied: You are not the owner of this content');

      await strapi.documents('api::user-entitlement.user-entitlement').delete({
        documentId: id
      });

      return ctx.send({ message: 'Enrollment revoked successfully' });
    },
  };
});
