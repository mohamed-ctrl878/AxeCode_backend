'use strict';

/**
 * Live Stream Socket Service
 * Manages real-time features: rooms, viewer counts, status updates
 */

// In-memory viewer count storage (can be replaced with Redis for scaling)
const viewerCounts = new Map();
const roomViewers = new Map();

module.exports = {
  /**
   * Initialize live stream socket handlers
   * @param {Server} io - Socket.IO server instance
   */
  initialize(io) {
    io.on('connection', (socket) => {
      // Handle joining a stream room
      socket.on('stream:join', async ({ streamId }) => {
        if (!streamId) return;
        
        socket.join(`stream:${streamId}`);
        
        // Track viewer
        if (!roomViewers.has(streamId)) {
          roomViewers.set(streamId, new Set());
        }
        roomViewers.get(streamId).add(socket.id);
        
        const count = roomViewers.get(streamId).size;
        viewerCounts.set(streamId, count);
        
        // Broadcast updated viewer count
        io.to(`stream:${streamId}`).emit('viewer:count', { streamId, count });
        
        // Update database periodically (every 5 viewers change)
        if (count % 5 === 0) {
          this.updateViewerCountInDB(streamId, count);
        }

        strapi.log.info(`[LiveStream] Socket ${socket.id} joined stream ${streamId}. Viewers: ${count}`);
      });

      // Handle leaving a stream room
      socket.on('stream:leave', ({ streamId }) => {
        if (!streamId) return;
        
        socket.leave(`stream:${streamId}`);
        
        if (roomViewers.has(streamId)) {
          roomViewers.get(streamId).delete(socket.id);
          const count = roomViewers.get(streamId).size;
          viewerCounts.set(streamId, count);
          
          io.to(`stream:${streamId}`).emit('viewer:count', { streamId, count });
          
          strapi.log.info(`[LiveStream] Socket ${socket.id} left stream ${streamId}. Viewers: ${count}`);
        }
      });

      // Clean up on disconnect
      socket.on('disconnect', () => {
        // Remove from all stream rooms
        for (const [streamId, viewers] of roomViewers.entries()) {
          if (viewers.has(socket.id)) {
            viewers.delete(socket.id);
            const count = viewers.size;
            viewerCounts.set(streamId, count);
            
            io.to(`stream:${streamId}`).emit('viewer:count', { streamId, count });
          }
        }
      });
    });

    strapi.log.info('[LiveStream] Socket handlers initialized');
  },

  /**
   * Get current viewer count for a stream
   */
  getViewerCount(streamId) {
    return viewerCounts.get(streamId) || 0;
  },

  /**
   * Update viewer count in database (for persistence)
   */
  async updateViewerCountInDB(streamId, count) {
    try {
      const stream = await strapi.documents('api::live-stream.live-stream').findOne({
        documentId: streamId,
      });

      if (stream) {
        await strapi.documents('api::live-stream.live-stream').update({
          documentId: streamId,
          data: {
            viewerCount: count,
            peakViewers: Math.max(stream.peakViewers || 0, count),
          },
        });
      }
    } catch (error) {
      strapi.log.error(`[LiveStream] Failed to update viewer count: ${error.message}`);
    }
  },

  /**
   * Broadcast stream status change
   */
  broadcastStatus(io, streamId, status) {
    io.to(`stream:${streamId}`).emit('stream:status', { streamId, status });
  },
};
