'use strict';

/**
 * Service to handle WebSocket logic for submissions
 */

module.exports = ({ strapi }) => ({
  initialize(io) {
    io.on('connection', (socket) => {
      // Join a specific submission room to get updates
      socket.on('join-submission', (submissionDocumentId) => {
        const room = `submission:${submissionDocumentId}`;
        socket.join(room);
        strapi.log.info(`Socket ${socket.id} joined submission room: ${room}`);
      });

      // Join a user room to get all updates for that user
      socket.on('join-user-submissions', (userDocumentId) => {
        const room = `user:${userDocumentId}`;
        socket.join(room);
        strapi.log.info(`Socket ${socket.id} joined user submissions room: ${room}`);
      });
      
      socket.on('leave-submission', (submissionDocumentId) => {
        const room = `submission:${submissionDocumentId}`;
        socket.leave(room);
        strapi.log.info(`Socket ${socket.id} left submission room: ${room}`);
      });
    });
  },

  /**
   * Broadcast submission results to relevant rooms
   */
  notifyComplete(submission) {
    if (strapi.io) {
      const room = `submission:${submission.documentId}`;
      strapi.log.info(`[SubmissionSocket] Emitting submission:complete to room ${room}`);
      
      // Send full submission data for UI update
      strapi.io.to(room).emit('submission:complete', submission);

      // Also notify the user specifically if authenticated
      if (submission.user) {
          const userId = submission.user.documentId || submission.user.id;
          const userRoom = `user:${userId}`;
          strapi.io.to(userRoom).emit('submission:update', submission);
      }
    }
  }
});
