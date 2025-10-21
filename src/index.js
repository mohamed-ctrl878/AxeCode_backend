'use strict';

const { Server } = require('socket.io');

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }) {
    // Initialize Socket.io
    const io = new Server(strapi.server.httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Make Socket.io accessible globally in Strapi
    strapi.io = io;

    // Handle connections
    io.on('connection', (socket) => {
      strapi.log.info(`[Socket.io] New connection: ${socket.id}`);

      // Handle joining conversation rooms
      socket.on('join-conversation', (conversationId) => {
        if (!conversationId) {
          strapi.log.warn(`[Socket.io] Invalid conversationId received`);
          return;
        }
        
        const room = `conversation-${conversationId}`;
        socket.join(room);
        strapi.log.info(`[Socket.io] Socket ${socket.id} joined room: ${room}`);
        
        // Notify user they've joined successfully
        socket.emit('joined-conversation', { conversationId, room });
      });

      // Handle leaving conversation rooms
      socket.on('leave-conversation', (conversationId) => {
        const room = `conversation-${conversationId}`;
        socket.leave(room);
        strapi.log.info(`[Socket.io] Socket ${socket.id} left room: ${room}`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        strapi.log.info(`[Socket.io] Disconnected: ${socket.id}`);
      });
    });

    strapi.log.info('[Socket.io] WebSocket server initialized');
  },
};
