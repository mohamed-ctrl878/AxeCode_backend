'use strict';

/**
 * RoomManager Service
 * Handles WebSocket room participation and status broadcasting.
 */

module.exports = ({ strapi }) => ({
  /**
   * Calculate unique online users in a room
   */
  getOnlineCount(io, conversationDocumentId, excludeSocketId = null) {
    if (!io) return 0;
    
    const room = `room-${conversationDocumentId}`;
    const roomSocketIds = io.sockets.adapter.rooms.get(room);
    
    if (!roomSocketIds) return 0;

    const uniqueUserIds = new Set();

    for (const socketId of roomSocketIds) {
      if (excludeSocketId && socketId === excludeSocketId) continue;

      const socket = io.sockets.sockets.get(socketId);
      if (socket && socket.user?.id) {
        uniqueUserIds.add(socket.user.id);
      }
    }
    
    return uniqueUserIds.size;
  },

  /**
   * Broadcast online count to the room
   */
  async broadcastStatusUpdate(io, conversationDocumentId, excludeSocketId = null) {
    if (!io) return;
    
    const onlineCount = this.getOnlineCount(io, conversationDocumentId, excludeSocketId);
    
    strapi.log.info(`[RoomManager] Room ${conversationDocumentId} status: ${onlineCount} online`);
    
    io.to(`room-${conversationDocumentId}`).emit('conversation-status-update', {
      conversationId: conversationDocumentId,
      onlineCount
    });
  },

  /**
   * Handle room join logic
   */
  join(socket, conversationDocumentId) {
    const room = `room-${conversationDocumentId}`;
    socket.join(room);
    strapi.log.info(`[RoomManager] Socket ${socket.id} joined ${room}`);
  },

  /**
   * Handle room leave logic
   */
  leave(socket, conversationDocumentId) {
    const room = `room-${conversationDocumentId}`;
    socket.leave(room);
    strapi.log.info(`[RoomManager] Socket ${socket.id} left ${room}`);
  }
});
