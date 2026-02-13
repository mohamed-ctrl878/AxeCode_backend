'use strict';

/**
 * live-stream controller
 * Handles stream CRUD and lifecycle operations.
 * Delegated business logic to api::live-stream.live-stream-logic for SOLID compliance.
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { LIVE_STREAM_POPULATE } = require('../constants');

module.exports = createCoreController('api::live-stream.live-stream', ({ strapi }) => ({
  
  // POST /lives-streams - Create a new stream session
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Authentication required');

    const logicService = strapi.service('api::live-stream.live-stream-logic');
    
    // Delegate metadata generation (keys, URLs) to logic service
    const metadata = logicService.generateStreamMetadata();
    
    ctx.request.body.data = {
      ...ctx.request.body.data,
      ...metadata,
      host: user.id,
      status: 'scheduled',
    };

    return await super.create(ctx);
  },

  // POST /live-streams/:id/start - Host starts broadcasting
  async start(ctx) {
    const { id } = ctx.params;
    const user = ctx.state.user;

    const stream = await strapi.documents('api::live-stream.live-stream').findOne({
      documentId: id,
      populate: ['host'],
    });

    if (!stream) return ctx.notFound('Stream not found');
    if (stream.host?.id !== user?.id) return ctx.forbidden('Unauthorized host');

    const updated = await strapi.service('api::live-stream.live-stream-logic')
      .updateStreamLifecycle(id, 'live');

    return { data: updated };
  },

  // POST /live-streams/:id/end - Host ends broadcasting
  async end(ctx) {
    const { id } = ctx.params;
    const user = ctx.state.user;

    const stream = await strapi.documents('api::live-stream.live-stream').findOne({
      documentId: id,
      populate: ['host'],
    });

    if (!stream) return ctx.notFound('Stream not found');
    if (stream.host?.id !== user?.id) return ctx.forbidden('Unauthorized host');

    const updated = await strapi.service('api::live-stream.live-stream-logic')
      .updateStreamLifecycle(id, 'ended');

    return { data: updated };
  },

  // Webhook from MediaMTX: Stream Started
  async webhookStart(ctx) {
    const { streamKey } = ctx.request.body;
    if (!streamKey) return ctx.badRequest('streamKey required');

    const facade = strapi.service('api::live-stream.media-lifecycle-facade');
    const result = await facade.handleMediaEvent(streamKey, 'live');

    return result ? { success: true } : ctx.notFound('Stream not found');
  },

  // Webhook from MediaMTX: Stream Ended
  async webhookEnd(ctx) {
    const { streamKey } = ctx.request.body;
    if (!streamKey) return ctx.badRequest('streamKey required');

    const facade = strapi.service('api::live-stream.media-lifecycle-facade');
    const result = await facade.handleMediaEvent(streamKey, 'ended');

    return result ? { success: true } : ctx.notFound('Stream not found');
  },

  // GET /live-streams/:id/key - Get streaming details for OBS
  async getStreamKey(ctx) {
    console.debug(ctx.params);
    const { id } = ctx.params;
    const user = ctx.state.user;

    const stream = await strapi.documents('api::live-stream.live-stream').findOne({
      documentId: id,
      populate: LIVE_STREAM_POPULATE, // Use centralized populate
    });

    if (!stream) return ctx.notFound('Stream not found');
    if (stream.host?.id !== user?.id) return ctx.forbidden('Restricted info');

    return { 
      streamKey: stream.streamKey,
      rtmpUrl: process.env.MEDIAMTX_RTMP_URL || 'rtmp://localhost:1935',
    };
  },
}));
