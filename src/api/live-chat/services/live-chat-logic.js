'use strict';

/**
 * LiveChatLogic Service
 * Handles business logic, socket notifications, and moderation for live chat.
 */

module.exports = ({ strapi }) => ({
  /**
   * High-level message creation and notification
   */
  async createMessage(data, user) {
    const { message, stream: streamId } = data;

    // 1. Create message in DB
    const response = await strapi.documents('api::live-chat.live-chat').create({
        data: {
            message,
            stream: streamId,
            user: user.id,
            isModerated: false,
        },
        status: 'published'
    });

    // 2. Notify via Socket
    if (strapi.io) {
        const chatMessage = {
            id: response.id,
            documentId: response.documentId,
            message,
            user: {
                id: user.id,
                username: user.username,
                firstname: user.firstname,
                lastname: user.lastname,
            },
            createdAt: response.createdAt || new Date(),
        };
        
        strapi.io.to(`stream:${streamId}`).emit('chat:message', chatMessage);
    }

    return response;
  },

  /**
   * Get formatted messages for a stream (DRY retrieval)
   */
  async getStreamMessages(streamId, page = 1, pageSize = 50) {
    const messages = await strapi.documents('api::live-chat.live-chat').findMany({
      filters: { 
        stream: { documentId: streamId },
        isModerated: false,
      },
      populate: ['user'],
      sort: { createdAt: 'asc' },
      start: (page - 1) * pageSize,
      limit: pageSize,
    });

    return messages.map(m => ({
        id: m.id,
        documentId: m.documentId,
        message: m.message,
        user: {
          id: m.user?.id,
          username: m.user?.username,
          firstname: m.user?.firstname,
          lastname: m.user?.lastname,
        },
        createdAt: m.createdAt,
    }));
  },

  /**
   * Moderate (hide) a message with authorization check
   */
  async moderateMessage(id, user) {
    const message = await strapi.documents('api::live-chat.live-chat').findOne({
      documentId: id,
      populate: ['stream', 'stream.host'],
    });

    if (!message) {
      throw new Error('Message not found');
    }

    // Authorization: Only host can moderate
    const hostId = message.stream?.host?.id || message.stream?.host?.documentId;
    if (hostId != user.id) {
      throw new Error('Only the host can moderate messages');
    }

    const updated = await strapi.documents('api::live-chat.live-chat').update({
      documentId: id,
      data: {
        isModerated: true,
        moderatedBy: user.id,
      },
    });

    // Emit moderation event
    if (strapi.io) {
      strapi.io.to(`stream:${message.stream.documentId}`).emit('chat:moderate', { 
        messageId: id,
        action: 'hidden',
      });
    }

    return updated;
  }
});
