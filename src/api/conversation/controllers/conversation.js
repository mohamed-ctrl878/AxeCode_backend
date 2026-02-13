'use strict';

/**
 * conversation controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::conversation.conversation', ({ strapi }) => {
  const getLogic = () => strapi.service('api::conversation.conversation-logic');
  const getModeration = () => strapi.service('api::conversation.messenger-moderation');

  return {
    async create(ctx) {
      if (!ctx.state.user) return ctx.unauthorized('Not authenticated');

      if (ctx.request.body.data) {
        ctx.request.body.data.creator = ctx.state.user.id;
      } else {
        ctx.request.body.creator = ctx.state.user.id;
      }
      
      return await super.create(ctx);
    },

    async find(ctx) {
      if (!ctx.state.user) return ctx.unauthorized('Not authenticated');

      // 1. Apply Logic-based filters (Inbox rules)
      ctx.query.filters = {
        ...(typeof ctx.query.filters === 'object' ? ctx.query.filters : {}),
        ...getLogic().getInboxFilters(ctx.state.user)
      };

      const result = await super.find(ctx);
      
      // 2. Delegate enrichment to Service
      if (result.data) {
        result.data = await getLogic().enrichMany(result.data);
      }

      return result;
    },

    async findOne(ctx) {
      if (!ctx.state.user) return ctx.unauthorized('Not authenticated');
      const { id } = ctx.params;

      // 1. Verify existence and permissions via Moderation service
      const { exists, isAdmin, conversation } = await getModeration().getPermissions(id, ctx.state.user.documentId);
      
      if (!exists) return ctx.notFound('Conversation not found');

      const isMember = conversation.members?.some(m => m.documentId === ctx.state.user.documentId) || isAdmin;
      if (!isMember) return ctx.forbidden('Unauthorized access');

      const response = await super.findOne(ctx);
      
      // 2. Enrich response
      if (response.data) {
        response.data = await getLogic().enrichConversation(response.data);
      }

      return response;
    },

    async update(ctx) {
      if (!ctx.state.user) return ctx.unauthorized('Not authenticated');
      const { id } = ctx.params;

      const { exists, isCreator } = await getModeration().getPermissions(id, ctx.state.user.documentId);
      if (!exists) return ctx.notFound();
      if (!isCreator) return ctx.forbidden('Only the creator can update');

      return await super.update(ctx);
    },

    async delete(ctx) {
      if (!ctx.state.user) return ctx.unauthorized('Not authenticated');
      const { id } = ctx.params;

      const { exists, isCreator } = await getModeration().getPermissions(id, ctx.state.user.documentId);
      if (!exists) return ctx.notFound();
      if (!isCreator) return ctx.forbidden('Only the creator can delete');

      return await super.delete(ctx);
    },
  };
});
