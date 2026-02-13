'use strict';

/**
 * ConversationLogic Service
 * Handles data enrichment and specialized business rules for Conversations.
 * Decouples controller from complex DB/Socket logic.
 */

module.exports = ({ strapi }) => ({
  /**
   * Enriches a single conversation object with metrics
   */
  async enrichConversation(conv) {
    if (!conv) return null;

    const messengerService = strapi.service('api::conversation.messenger');
    const roomManager = strapi.service('api::conversation.room-manager');

    // 1. Get Online Count (from specialized room manager)
    // We try to get the current IO instance if initialized
    const io = strapi.io; 
    const onlineCount = roomManager.getOnlineCount(io, conv.documentId || conv.id);

    // 2. Get Members Count (Reverse query for accuracy)
    const membersCount = await strapi.documents('plugin::users-permissions.user').count({
      filters: { 
        conversations: { 
          $or: [
            { id: { $eq: conv.id } },
            { documentId: { $eq: conv.documentId } }
          ]
        } 
      }
    });

    return {
      ...conv,
      membersCount: membersCount || 0,
      onlineCount
    };
  },

  /**
   * Enriches matching a list of conversations
   */
  async enrichMany(conversations) {
    if (!conversations || !Array.isArray(conversations)) return [];
    return await Promise.all(conversations.map(conv => this.enrichConversation(conv)));
  },

  /**
   * Generate standard filters for user's inbox
   */
  getInboxFilters(user) {
    if (!user) return {};
    return {
      $or: [
        { members: { id: user.id } },
        { admins: { id: user.id } },
        { creator: { id: user.id } }
      ]
    };
  }
});
