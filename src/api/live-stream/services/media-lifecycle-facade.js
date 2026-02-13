'use strict';

/**
 * MediaLifecycleFacade Service
 * Orchestrates status updates from external media servers (MediaMTX)
 * and bridges them with internal features like LiveStream state and LiveChat notifications.
 */

module.exports = ({ strapi }) => ({
  /**
   * Handle incoming media server lifecycle events
   */
  async handleMediaEvent(streamKey, status) {
    const liveStreamLogic = strapi.service('api::live-stream.live-stream-logic');

    // 1. Update Domain State (LiveStream status)
    const updatedStream = await liveStreamLogic.handleWebhook(streamKey, status);

    if (!updatedStream) return null;

    // 2. Cross-domain Orchestration: Notify LiveChat
    // If the stream is live, we might want to automatically enable certain chat features
    if (status === 'live') {
      this.announceLiveStatus(updatedStream);
    }

    return updatedStream;
  },

  /**
   * Orchestrate high-level notifications
   */
  announceLiveStatus(stream) {
    if (strapi.io) {
      strapi.io.emit('broadcast:started', {
        id: stream.documentId,
        title: stream.title,
        startTime: new Date()
      });
      strapi.log.info(`[MediaLifecycle] Broadcast announced for ${stream.documentId}`);
    }
  }
});
