"use strict";

module.exports = {
  async afterCreate(event) {
    const { result, params } = event;
    const { data } = params;

    // Use Strapi service to update interests
    if (result.users_permissions_user && result.docId && result.content_types) {
      const userId = result.users_permissions_user.id || (data.users_permissions_user && data.users_permissions_user.id) || data.users_permissions_user;
      
      if (userId) {
        await strapi.service("api::recommendation.recommendation").updateUserInterests(
          userId,
          result.docId,
          result.content_types,
          "like"
        );
      }
    }
  },
};
