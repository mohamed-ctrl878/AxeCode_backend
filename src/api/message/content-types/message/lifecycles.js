'use strict';

module.exports = {
  /**
   * Called after a message is created
   */
  async afterCreate(event) {
    const { result } = event;

    try {
      // Get the message with populated relationships
      const messageWithRelations = await strapi.entityService.findOne(
        'api::message.message',
        result.id,
        {
          populate: {
            users_permissions_user: {
              fields: ['id', 'username', 'email'],
            },
            conversation: {
              fields: ['id', 'title'],
            },
          },
        }
      );

      if (messageWithRelations && messageWithRelations.conversation) {
        const conversationId = messageWithRelations.conversation.id;
        const room = `conversation-${conversationId}`;

        // Broadcast the new message to all users in the conversation room
        strapi.io.to(room).emit('new-message', {
          id: messageWithRelations.id,
          message: messageWithRelations.message,
          createdAt: messageWithRelations.createdAt,
          updatedAt: messageWithRelations.updatedAt,
          sender: messageWithRelations.users_permissions_user,
          conversationId: conversationId,
        });

        strapi.log.info(
          `[Lifecycle] Broadcasted message ${result.id} to room: ${room}`
        );
      }
    } catch (error) {
      strapi.log.error('[Lifecycle] Error broadcasting message:', error);
    }
  },

  /**
   * Optional: Called after a message is updated
   */
  async afterUpdate(event) {
    const { result } = event;

    try {
      // Get the message with populated relationships
      const messageWithRelations = await strapi.entityService.findOne(
        'api::message.message',
        result.id,
        {
          populate: {
            users_permissions_user: {
              fields: ['id', 'username', 'email'],
            },
            conversation: {
              fields: ['id', 'title'],
            },
          },
        }
      );

      if (messageWithRelations && messageWithRelations.conversation) {
        const conversationId = messageWithRelations.conversation.id;
        const room = `conversation-${conversationId}`;

        // Broadcast the updated message
        strapi.io.to(room).emit('message-updated', {
          id: messageWithRelations.id,
          message: messageWithRelations.message,
          createdAt: messageWithRelations.createdAt,
          updatedAt: messageWithRelations.updatedAt,
          sender: messageWithRelations.users_permissions_user,
          conversationId: conversationId,
        });

        strapi.log.info(
          `[Lifecycle] Broadcasted message update ${result.id} to room: ${room}`
        );
      }
    } catch (error) {
      strapi.log.error('[Lifecycle] Error broadcasting message update:', error);
    }
  },

  /**
   * Optional: Called after a message is deleted
   */
  async afterDelete(event) {
    const { result } = event;

    try {
      // Note: After deletion, we can only access the deleted data from the result
      if (result && result.conversation) {
        const conversationId = result.conversation.id || result.conversation;
        const room = `conversation-${conversationId}`;

        // Broadcast message deletion
        strapi.io.to(room).emit('message-deleted', {
          id: result.id,
          conversationId: conversationId,
        });

        strapi.log.info(
          `[Lifecycle] Broadcasted message deletion ${result.id} to room: ${room}`
        );
      }
    } catch (error) {
      strapi.log.error('[Lifecycle] Error broadcasting message deletion:', error);
    }
  },
};
