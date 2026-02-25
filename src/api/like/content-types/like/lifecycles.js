"use strict";

module.exports = {
  async afterCreate(event) {
    const { result, params } = event;
    const { data } = params;

    const userId = result.users_permissions_user?.id ||
      (data.users_permissions_user && typeof data.users_permissions_user === 'object'
        ? data.users_permissions_user.id
        : data.users_permissions_user);

    const docId = result.docId || data.docId;
    const contentType = result.content_types || data.content_types;

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
