'use strict';

/**
 * user-entitlement controller
 * SOLID: Controller handles HTTP, enrichment logic is encapsulated
 */

const { createCoreController } = require('@strapi/strapi').factories;

const { CONTENT_TYPES } = require('../../entitlement/constants');

module.exports = createCoreController('api::user-entitlement.user-entitlement', ({ strapi }) => {
  const getFacade = () => strapi.service('api::entitlement.content-access-facade');

  return {
    async create(ctx) {
      if (!ctx.state.user) return ctx.unauthorized('Not authenticated');

      const { productId, content_types } = ctx.request?.body?.data || ctx.request?.body;
      if (!productId || !content_types) return ctx.badRequest('productId and content_types are required');

      // Check existence
      const existing = await strapi.db.query("api::user-entitlement.user-entitlement").findOne({
        where: { productId, users_permissions_user: ctx.state.user.id, content_types }
      });
      if (existing) return ctx.badRequest("You already have this content!");

      const entitlement = await strapi.documents('api::entitlement.entitlement').findOne({ documentId: productId });
      if (!entitlement) return ctx.notFound('Product not found');

      // Payment check (Only allow free via this endpoint)
      if (parseFloat(entitlement.price) !== 0) return ctx.badRequest('This product requires payment');

      const userEntitlement = await strapi.documents('api::user-entitlement.user-entitlement').create({
        data: {
          productId,
          users_permissions_user: ctx.state.user.id,
          duration: entitlement.duration,
          strart: new Date().toISOString(),
          content_types,
          valid: 'successed'
        },
        status: 'published',
      });

      // Use Facade for enrichment (DRY!)
      const enriched = await getFacade().getFullDetails(entitlement.itemId, content_types, ctx.state.user.id);
      
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

      // Get associated entitlement to find itemId
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

      const userEntitlements = await strapi.documents('api::user-entitlement.user-entitlement').findMany({
        filters: { users_permissions_user: { id: ctx.state.user.id } },
      });

      // Simple enrichment (can be optimized further with an enrichMany in Facade for this specific join)
      const data = await Promise.all(userEntitlements.map(async (ue) => {
          const entitlements = await strapi.documents('api::entitlement.entitlement').findMany({
              filters: { documentId: ue.productId }
          });
          const entitlement = entitlements[0];
          let content = null;
          if (entitlement) {
              content = await getFacade().getFullDetails(entitlement.itemId, entitlement.content_types, ctx.state.user.id);
          }
          return { ...ue, content };
      }));

      return ctx.send({ data });
    },
  };
});
