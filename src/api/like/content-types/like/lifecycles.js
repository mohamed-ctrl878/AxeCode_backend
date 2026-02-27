"use strict";

module.exports = {
  async afterCreate(event) {
    const { result, params } = event;
    const { data } = params;

    let parsedUserId = null;
    if (result.users_permissions_user?.id) {
      parsedUserId = result.users_permissions_user.id;
    } else if (data.users_permissions_user) {
      // Handle Strapi 5 internal relation structures
      if (typeof data.users_permissions_user === 'string' || typeof data.users_permissions_user === 'number') {
        parsedUserId = data.users_permissions_user;
      } else if (Array.isArray(data.users_permissions_user)) {
        parsedUserId = data.users_permissions_user[0];
      } else if (data.users_permissions_user.set && Array.isArray(data.users_permissions_user.set)) {
        parsedUserId = data.users_permissions_user.set[0]?.documentId || data.users_permissions_user.set[0]?.id || data.users_permissions_user.set[0];
      } else if (data.users_permissions_user.connect && Array.isArray(data.users_permissions_user.connect)) {
        parsedUserId = data.users_permissions_user.connect[0]?.documentId || data.users_permissions_user.connect[0]?.id || data.users_permissions_user.connect[0];
      } else {
        parsedUserId = data.users_permissions_user.documentId || data.users_permissions_user.id;
      }
    }
    const userId = parsedUserId;

    const docId = result.docId || data.docId;
    const contentType = result.content_types || data.content_types;

    console.debug("event.result", JSON.stringify(result, null, 2));
    console.debug("event.params.data", JSON.stringify(data, null, 2));
    console.debug("userId", userId);
    console.debug("docId", docId);
    console.debug("contentType", contentType);

    // Use Strapi service to update interests
    if (userId && docId && contentType) {
      await strapi.service("api::recommendation.recommendation").updateUserInterests(
        userId,
        docId,
        contentType,
        "like"
      );
    }
  },
};
