'use strict';

/**
 * live-chat controller
 * Handles chat messages for live streams
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::live-chat.live-chat', ({ strapi }) => {
  const getLogic = () => strapi.service('api::live-chat.live-chat-logic');

  return {
    async create(ctx) {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized('You must be logged in to send messages');

      const { message, stream } = ctx.request.body.data || {};
      if (!message || !stream) return ctx.badRequest('Message and stream are required');

      try {
        const result = await getLogic().createMessage(ctx.request.body.data, user);
        return ctx.send({ data: result });
      } catch (err) {
        return ctx.badRequest(err.message);
      }
    },

    async findByStream(ctx) {
      const { streamId } = ctx.params;
      const { page = 1, pageSize = 50 } = ctx.query;

      const data = await getLogic().getStreamMessages(streamId, parseInt(String(page)), parseInt(String(pageSize)));
      return ctx.send({ data });
    },

    async moderate(ctx) {
      const { id } = ctx.params;
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized('You must be logged in');

      try {
        const result = await getLogic().moderateMessage(id, user);
        return ctx.send({ data: result });
      } catch (err) {
        const status = err.message.includes('not found') ? 404 : 403;
        return ctx.send({ error: err.message }, status);
      }
    },
  };
});
