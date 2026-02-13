"use strict";

module.exports = {
  async afterCreate(event) {
    const { result, params } = event;
    const { data } = params;

    // Get userId from relation
    const userId = result.reporter_user?.id || 
                   (data.reporter_user && typeof data.reporter_user === 'object' 
                     ? data.reporter_user.id 
                     : data.reporter_user);
    
    const docId = result.docId || data.docId;
    const contentType = result.content_type || data.content_type;

    // Only process if content-level report (not just user report)
    if (userId && docId && contentType) {
      // Report gives -5 interest (negative feedback)
      await strapi.service("api::recommendation.recommendation").updateUserInterests(
        userId,
        docId,
        contentType,
        "report"
      );
    }
  },
};
