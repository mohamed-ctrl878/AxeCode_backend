'use strict';

/**
 * MessagingService
 * Handles message validation, database saving, and history fetching.
 */

module.exports = ({ strapi }) => ({
  /**
   * Validate rich text blocks (Recursive)
   */
  validateBlocks(blocks) {
    if (!Array.isArray(blocks) || blocks.length === 0) return { valid: false, reason: 'Empty content' };

    const validateNode = (node, path = '') => {
      if (!node || typeof node !== 'object') return { valid: false, reason: `Invalid leaf at ${path}` };
      if (!node.type) return { valid: false, reason: `Missing type at ${path}` };

      if (path === '') {
        const allowedTypes = ['paragraph', 'heading', 'list', 'quote', 'code', 'image'];
        if (!allowedTypes.includes(node.type)) return { valid: false, reason: `Invalid top block: ${node.type}` };
      }

      if (node.children) {
        if (!Array.isArray(node.children)) return { valid: false, reason: `Children must be array at ${path}` };
        for (let i = 0; i < node.children.length; i++) {
          const res = validateNode(node.children[i], `${path}[${node.type}].${i}`);
          if (!res.valid) return res;
        }
      } else if (node.type === 'text') {
        if (typeof node.text !== 'string') return { valid: false, reason: `Text missing content at ${path}` };
      } else if (node.type !== 'image') {
        return { valid: false, reason: `Node ${node.type} missing children/text` };
      }

      return { valid: true };
    };

    for (let i = 0; i < blocks.length; i++) {
      const res = validateNode(blocks[i]);
      if (!res.valid) return res;
    }
    return { valid: true };
  },

  /**
   * Save message to DB
   */
  async saveMessage(conversationDocumentId, userDocumentId, blocks) {
    return await strapi.documents('api::message.message').create({
      data: {
        conversation: conversationDocumentId,
        users_permissions_user: userDocumentId,
        message: blocks,
      },
      status: 'published',
      populate: {
        users_permissions_user: {
          fields: ['id', 'username'],
          populate: {
            role: { fields: ['type'] },
            avatar: { fields: ['url'] }
          }
        }
      }
    });
  },

  /**
   * Fetch conversation history
   */
  async getHistory(conversationDocumentId, limit = 50, beforeTimestamp = null) {
    const filters = { conversation: { documentId: { $eq: conversationDocumentId } } };
    if (beforeTimestamp) {
      filters.createdAt = { $lt: beforeTimestamp };
    }

    const messages = await strapi.documents('api::message.message').findMany({
      filters,
      sort: 'createdAt:desc',
      limit,
      populate: {
        users_permissions_user: {
          fields: ['id', 'username'],
          populate: {
            role: { fields: ['type'] },
            avatar: { fields: ['url'] }
          }
        },
      },
    });

    return messages.map(m => this.formatMessage(m, conversationDocumentId)).reverse();
  },

  /**
   * Unified message formatter
   */
  formatMessage(m, conversationId) {
    return {
      id: m.id,
      conversationId: conversationId,
      sender: {
        id: m.users_permissions_user?.id,
        username: m.users_permissions_user?.username,
        role: m.users_permissions_user?.role?.type,
        avatar: m.users_permissions_user?.avatar?.url,
      },
      blocks: m.message,
      createdAt: m.createdAt,
      status: 'sent',
    };
  }
});
