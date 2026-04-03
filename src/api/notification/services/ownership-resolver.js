'use strict';

const { OWNERSHIP_MAP } = require('../constants');

module.exports = {
  /**
   * Resolves the owner of a content item.
   * 
   * @param {string} contentType - The content type enum value
   * @param {string} docId       - The documentId of the content
   * @returns {Promise<{ ownerDocumentId: string, ownerUsername: string } | null>}
   */
  async resolve(contentType, docId) {
    const mapping = OWNERSHIP_MAP[contentType];
    if (!mapping) {
      strapi.log.warn(`[OwnershipResolver] Unsupported content type: ${contentType}`);
      return null;
    }

    const content = await strapi.documents(mapping.uid).findFirst({
      filters: { documentId: docId },
      populate: { [mapping.ownerField]: { fields: ['documentId', 'username'] } },
    });

    if (!content || !content[mapping.ownerField]) {
      strapi.log.warn(`[OwnershipResolver] Content or owner not found for ${contentType}:${docId}`);
      return null;
    }

    return {
      ownerDocumentId: content[mapping.ownerField].documentId,
      ownerUsername: content[mapping.ownerField].username,
    };
  }
};
