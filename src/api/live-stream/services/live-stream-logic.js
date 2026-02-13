'use strict';

const crypto = require('crypto');

/**
 * LiveStreamLogic Service
 * Handles core business logic for live streams, separate from Strapi's core data service.
 */

module.exports = ({ strapi }) => ({
  /**
   * Generates unique stream metadata for a new broadcast
   * @returns {Object} streamKey and playbackUrl
   */
  generateStreamMetadata() {
    const streamKey = crypto.randomBytes(16).toString('hex');
    const hlsBase = process.env.MEDIAMTX_HLS_URL || 'http://localhost:8888';
    
    // MediaMTX Default HLS structure: base_url/stream_key/index.m3u8
    const playbackUrl = `${hlsBase}/${streamKey}/index.m3u8`;

    return {
      streamKey,
      playbackUrl,
    };
  },

  /**
   * Updates stream lifecycle status and notifies via WebSocket
   * @param {string} documentId - The stream document identifier
   * @param {string} status - New status ('live', 'ended', etc.)
   */
  async updateStreamLifecycle(documentId, status) {
    const data = { status };
    
    if (status === 'live') {
      data.startedAt = new Date();
    } else if (status === 'ended') {
      data.endedAt = new Date();
    }

    const updatedStream = await strapi.documents('api::live-stream.live-stream').update({
      documentId,
      data,
    });

    // Notify via socket
    this.notifyStatusChange(documentId, status);

    return updatedStream;
  },

  /**
   * Handles incoming webhooks from MediaMTX
   * @param {string} streamKey 
   * @param {string} status 
   */
  async handleWebhook(streamKey, status) {
    const streams = await strapi.documents('api::live-stream.live-stream').findMany({
      filters: { streamKey },
    });

    if (streams.length === 0) {
      strapi.log.warn(`[LiveStreamLogic] Received webhook for unknown streamKey: ${streamKey}`);
      return null;
    }

    const stream = streams[0];
    return await this.updateStreamLifecycle(stream.documentId, status);
  },

  /**
   * Centralized WebSocket notification
   */
  notifyStatusChange(streamId, status) {
    if (strapi.io) {
      strapi.io.to(`stream:${streamId}`).emit('stream:status', { 
        streamId, 
        status 
      });
      strapi.log.info(`[LiveStreamLogic] Status notification sent for ${streamId}: ${status}`);
    }
  }
});
