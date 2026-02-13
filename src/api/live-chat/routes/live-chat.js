'use strict';

/**
 * live-chat router
 */

module.exports = {
  routes: [
    // ============ CORE CRUD Routes ============
    {
      method: 'GET',
      path: '/live-chats',
      handler: 'live-chat.find',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'GET',
      path: '/live-chats/:id',
      handler: 'live-chat.findOne',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/live-chats',
      handler: 'live-chat.create',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'DELETE',
      path: '/live-chats/:id',
      handler: 'live-chat.delete',
      config: { policies: [], middlewares: [] },
    },
    // ============ Custom Routes ============
    // Get messages for a stream
    {
      method: 'GET',
      path: '/live-streams/:streamId/chat',
      handler: 'live-chat.findByStream',
      config: { policies: [], middlewares: [] },
    },
    // Send message to a stream
    {
      method: 'POST',
      path: '/live-streams/:streamId/chat',
      handler: 'live-chat.create',
      config: { policies: [], middlewares: [] },
    },
    // Moderate a message
    {
      method: 'POST',
      path: '/live-chats/:id/moderate',
      handler: 'live-chat.moderate',
      config: { policies: [], middlewares: [] },
    },
  ],
};
