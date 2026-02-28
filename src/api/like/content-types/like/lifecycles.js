"use strict";

const extractUserId = (result, data) => {
  if (result?.users_permissions_user?.id) {
    return result.users_permissions_user.id;
  } else if (result?.users_permissions_user?.documentId) {
    return result.users_permissions_user.documentId;
  } else if (data?.users_permissions_user) {
    if (typeof data.users_permissions_user === 'string' || typeof data.users_permissions_user === 'number') {
      return data.users_permissions_user;
    } else if (Array.isArray(data.users_permissions_user)) {
      return data.users_permissions_user[0];
    } else if (data.users_permissions_user.set && Array.isArray(data.users_permissions_user.set)) {
      return data.users_permissions_user.set[0]?.documentId || data.users_permissions_user.set[0]?.id || data.users_permissions_user.set[0];
    } else if (data.users_permissions_user.connect && Array.isArray(data.users_permissions_user.connect)) {
      return data.users_permissions_user.connect[0]?.documentId || data.users_permissions_user.connect[0]?.id || data.users_permissions_user.connect[0];
    } else {
      return data.users_permissions_user.documentId || data.users_permissions_user.id;
    }
  }
  return null;
};

module.exports = {
  async afterCreate(event) {
    const { result, params } = event;
    const { data } = params || {};
    const userId = extractUserId(result, data);
    const docId = result?.docId || data?.docId;
    const contentType = result?.content_types || data?.content_types;

    if (userId && docId && contentType) {
      await strapi.service("api::recommendation.recommendation").updateUserInterests(
        userId,
        docId,
        contentType,
        "like"
      );
    }
  },

  async afterDelete(event) {
    const { result, params } = event;
    const { data } = params || {};
    // Fallback to result if data is missing during delete hook
    const userId = extractUserId(result, data || result);
    const docId = result?.docId || data?.docId;
    const contentType = result?.content_types || data?.content_types;

    if (userId && docId && contentType) {
      await strapi.service("api::recommendation.recommendation").updateUserInterests(
        userId,
        docId,
        contentType,
        "unlike"
      );
    }
  },
};
