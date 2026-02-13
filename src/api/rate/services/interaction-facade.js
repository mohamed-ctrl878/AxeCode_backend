'use strict';

/**
 * interaction-facade service
 * A domain facade to centralize rating, like, and comment stats.
 */

module.exports = ({ strapi }) => ({
  /**
   * Get all interaction metadata for a piece of content
   */
  async getMetadata(contentType, docId, userId = null) {
    // 1. Get Rating Summary (Skip for events)
    let ratingSummary = { average: 0, count: 0 };
    if (contentType !== 'event') {
      ratingSummary = await strapi.service('api::rate.rate').getSummary(contentType, docId);
    }

    // 2. Get Likes Count (Skip for articles and lessons)
    let likesCount = 0;
    if (contentType !== 'article' && contentType !== 'lesson') {
      likesCount = await strapi.documents('api::like.like').count({
        filters: { content_types: contentType, docId: docId },
        status: 'published'
      });
    }

    // 3. Check if user liked it (Skip for articles and lessons)
    let isLikedByMe = false;
    if (userId && contentType !== 'article' && contentType !== 'lesson') {
      const userLike = await strapi.documents('api::like.like').findFirst({
        filters: { 
          content_types: contentType, 
          docId: docId, 
          users_permissions_user: { id: userId } 
        },
        status: 'published'
      });
      isLikedByMe = !!userLike;
    }

    // 4. Get My Rating (Skip for events)
    let myRating = 0;
    if (userId && contentType !== 'event') {
      const userRate = await strapi.documents('api::rate.rate').findFirst({
        filters: {
          content_types: contentType,
          docId: docId,
          users_permissions_user: { id: userId }
        },
        fields: ['rate'],
        status: 'published'
      });
      myRating = userRate ? userRate.rate : 0;
    }

    // 5. Get Comments Count
    const commentsCount = await strapi.documents('api::comment.comment').count({
      filters: { content_types: contentType, docId: docId },
      status: 'published'
    });

    return {
      rating: ratingSummary,
      likesCount,
      isLikedByMe,
      myRating,
      commentsCount
    };
  }
});
