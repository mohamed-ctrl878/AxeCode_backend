'use strict';

/**
 * live-stream router
 */

module.exports = {
  routes: [
    // ============ CORE CRUD Routes ============
    {
      method: 'GET',
      path: '/live-streams',
      handler: 'live-stream.find',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/live-streams/:id',
      handler: 'live-stream.findOne',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/live-streams',
      handler: 'live-stream.create',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'PUT',
      path: '/live-streams/:id',
      handler: 'live-stream.update',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'DELETE',
      path: '/live-streams/:id',
      handler: 'live-stream.delete',
      config: { policies: [], middlewares: [] },
    },
    // ============ Custom Routes ============
    // Start stream (host only)
    {
      method: 'POST',
      path: '/live-streams/:id/start',
      handler: 'live-stream.start',
      config: { policies: [], middlewares: [] },
    },
    // End stream (host only)
    {
      method: 'POST',
      path: '/live-streams/:id/end',
      handler: 'live-stream.end',
      config: { policies: [], middlewares: [] },
    },
    // Get stream key (host only)
    {
      method: 'GET',
      path: '/live-streams/:id/key',
      handler: 'live-stream.getStreamKey',
      config: { policies: [], middlewares: [] },
    },
    // MediaMTX webhooks (internal, no auth)
    {
      method: 'POST',
      path: '/live-streams/webhook/start',
      handler: 'live-stream.webhookStart',
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/live-streams/webhook/end',
      handler: 'live-stream.webhookEnd',
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
};
