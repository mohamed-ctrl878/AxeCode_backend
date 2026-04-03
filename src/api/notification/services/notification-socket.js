'use strict';

module.exports = {
  initialize(io) {
    io.on('connection', (socket) => {
      // Auto-join user's notification room 
      socket.on('auth:join', (userDocumentId) => {
        if (!userDocumentId) return;
        const roomName = `user:${userDocumentId}`;
        socket.join(roomName);
        strapi.log.debug(`[NotificationSocket] User ${userDocumentId} joined room ${roomName}`);
      });
      
      // Optional: leave room
      socket.on('auth:leave', (userDocumentId) => {
        if (!userDocumentId) return;
        const roomName = `user:${userDocumentId}`;
        socket.leave(roomName);
      });
    });
    
    strapi.log.info('[NotificationSocket] Initialized');
  }
};
