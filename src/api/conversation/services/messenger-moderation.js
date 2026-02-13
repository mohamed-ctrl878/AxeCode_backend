'use strict';

/**
 * MessengerModeration Service
 * Handles administrative actions like muting and membership management.
 */

module.exports = ({ strapi }) => ({
  /**
   * Verify if a user is an admin or creator of a conversation
   */
  async getPermissions(conversationId, userDocumentId) {
    const isNumeric = !isNaN(conversationId) && !isNaN(parseFloat(conversationId));
    const filter = isNumeric 
      ? { id: { $eq: Number(conversationId) } }
      : { documentId: { $eq: conversationId } };

    const conversation = await strapi.documents('api::conversation.conversation').findFirst({
      filters: filter,
      populate: {
        creator: { fields: ['documentId'] },
        admins: { fields: ['documentId'] },
        muted_users: { fields: ['documentId'] },
        members: { fields: ['documentId'] }
      }
    });

    if (!conversation) return { exists: false };

    const isCreator = conversation.creator?.documentId === userDocumentId;
    const isAdmin = conversation.admins?.some(a => a.documentId === userDocumentId) || isCreator;

    return { 
      exists: true, 
      isCreator, 
      isAdmin, 
      conversation 
    };
  },

  /**
   * Toggle mute status for a user
   */
  async toggleMute(conversationDocumentId, targetUserDocId) {
    const conversation = await strapi.documents('api::conversation.conversation').findOne({
      documentId: conversationDocumentId,
      populate: { muted_users: { fields: ['documentId'] } }
    });

    if (!conversation) throw new Error('Conversation not found');

    const mutedIds = conversation.muted_users?.map(u => u.documentId) || [];
    const isMuted = mutedIds.includes(targetUserDocId);
    
    let newMutedIds;
    if (isMuted) {
      newMutedIds = mutedIds.filter(id => id !== targetUserDocId);
    } else {
      newMutedIds = [...mutedIds, targetUserDocId];
    }

    await strapi.documents('api::conversation.conversation').update({
      documentId: conversationDocumentId,
      data: { muted_users: newMutedIds },
      status: 'published'
    });

    return !isMuted;
  },

  /**
   * Manage member roles (add/remove member/admin)
   */
  async manageRoles(conversationDocumentId, targetUserDocId, action) {
    const conversation = await strapi.documents('api::conversation.conversation').findOne({
      documentId: conversationDocumentId,
      populate: { members: { fields: ['documentId'] }, admins: { fields: ['documentId'] } }
    });

    let members = conversation.members?.map(m => m.documentId) || [];
    let admins = conversation.admins?.map(a => a.documentId) || [];

    switch (action) {
      case 'add_member':
        if (!members.includes(targetUserDocId) && !admins.includes(targetUserDocId)) members.push(targetUserDocId);
        break;
      case 'remove_member':
        members = members.filter(id => id !== targetUserDocId);
        admins = admins.filter(id => id !== targetUserDocId);
        break;
      case 'add_admin':
        if (!admins.includes(targetUserDocId)) admins.push(targetUserDocId);
        members = members.filter(id => id !== targetUserDocId);
        break;
      case 'remove_admin':
        admins = admins.filter(id => id !== targetUserDocId);
        if (!members.includes(targetUserDocId)) members.push(targetUserDocId);
        break;
    }

    await strapi.documents('api::conversation.conversation').update({
      documentId: conversationDocumentId,
      data: { members, admins },
      status: 'published'
    });

    return true;
  }
});
