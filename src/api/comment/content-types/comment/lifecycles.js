"use strict";

module.exports = {
  async afterCreate(event) {
    const { result, params } = event;
    const { data } = params;

    // Get userId from relation or direct ID
    const userId = result.users_permissions_user?.id || 
                   (data.users_permissions_user && typeof data.users_permissions_user === 'object' 
                     ? data.users_permissions_user.id 
                     : data.users_permissions_user);
    
    const docId = result.docId || data.docId;
    const contentType = result.content_types || data.content_types;

    if (userId && docId && contentType) {
      // Comment gives +1 interest boost
      await strapi.service("api::recommendation.recommendation").updateUserInterests(
        userId,
        docId,
        contentType,
        "click" // Using click score (1) for comments
      );
    }
  },
};
