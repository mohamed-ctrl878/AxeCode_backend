"use strict";

/**
 * recommendation controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::recommendation.recommendation", ({ strapi }) => ({
  // Unified feed (all types grouped)
  async getFeed(ctx) {
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized("Authentication required for personalized feed");
    }

    const query = ctx.query || {};
    const type = query.type;
    const limit = query.limit;
    const feedType = query.feedType || 'recommend';

    let feed;
    if (feedType === 'trend') {
      feed = await strapi.service("api::recommendation.trend").getTrendingFeed(
        user,
        limit ? parseInt(String(limit), 10) : 20,
        type
      );
    } else {
      const excludeStr = String(query.excludeIds || '');
      const excludeIdsArray = excludeStr.length > 0 ? excludeStr.split(',') : [];

      feed = await strapi.service("api::recommendation.recommendation").getFeed(
        user,
        limit ? parseInt(String(limit), 10) : 20,
        type,
        excludeIdsArray,
        query.populate
      );
    }
    return { data: feed };
  },

  // Separate endpoints per content type
  async getArticles(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const query = ctx.query || {};
    const limit = query.limit;
    const feedType = query.feedType || 'recommend';

    let feed;
    if (feedType === 'trend') {
      feed = await strapi.service("api::recommendation.trend").getTrendingFeed(
        user,
        limit ? parseInt(String(limit), 10) : 20,
        "article"
      );
    } else if (feedType === 'top') {
      const topItems = await strapi.documents('api::article.article').findMany({
        sort: { engagement_score: 'desc' },
        limit: limit ? parseInt(String(limit), 10) : 20,
        status: 'published',
        populate: '*'
      });

      const userDocId = user.documentId || user.id;
      feed = await Promise.all(
        topItems.map(item => strapi.service('api::article.article').enrichArticle(item, userDocId))
      );
    } else {
      const excludeStr = String(query.excludeIds || '');
      const excludeIdsArray = excludeStr.length > 0 ? excludeStr.split(',') : [];

      feed = await strapi.service("api::recommendation.recommendation").getFeed(
        user,
        limit ? parseInt(String(limit), 10) : 20,
        "article",
        excludeIdsArray,
        query.populate
      );
    }
    return { data: feed };
  },

  async getBlogs(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const query = ctx.query || {};
    const limit = query.limit;
    const feedType = query.feedType || 'recommend';

    let feed;
    if (feedType === 'trend') {
      feed = await strapi.service("api::recommendation.trend").getTrendingFeed(
        user,
        limit ? parseInt(String(limit), 10) : 20,
        "blog"
      );
    } else {
      const excludeStr = String(query.excludeIds || '');
      const excludeIdsArray = excludeStr.length > 0 ? excludeStr.split(',') : [];

      feed = await strapi.service("api::recommendation.recommendation").getFeed(
        user,
        limit ? parseInt(String(limit), 10) : 20,
        "blog",
        excludeIdsArray,
        query.populate
      );
    }
    return { data: feed };
  },

  async getPosts(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const query = ctx.query || {};
    const limit = query.limit;
    const feedType = query.feedType || 'recommend';

    let feed;
    if (feedType === 'trend') {
      feed = await strapi.service("api::recommendation.trend").getTrendingFeed(
        user,
        limit ? parseInt(String(limit), 10) : 20,
        "post"
      );
    } else {
      const excludeStr = String(query.excludeIds || '');
      const excludeIdsArray = excludeStr.length > 0 ? excludeStr.split(',') : [];

      feed = await strapi.service("api::recommendation.recommendation").getFeed(
        user,
        limit ? parseInt(String(limit), 10) : 20,
        "post",
        excludeIdsArray,
        query.populate
      );
    }
    return { data: feed };
  },

  async getCourses(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const query = ctx.query || {};
    const limit = query.limit;
    const feedType = query.feedType || 'recommend';

    let feed;
    if (feedType === 'trend') {
      feed = await strapi.service("api::recommendation.trend").getTrendingFeed(
        user,
        limit ? parseInt(String(limit), 10) : 20,
        "course"
      );
    } else {
      const excludeStr = String(query.excludeIds || '');
      const excludeIdsArray = excludeStr.length > 0 ? excludeStr.split(',') : [];

      feed = await strapi.service("api::recommendation.recommendation").getFeed(
        user,
        limit ? parseInt(String(limit), 10) : 20,
        "course",
        excludeIdsArray,
        query.populate
      );
    }
    return { data: feed };
  },

  async getProblems(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const query = ctx.query || {};
    const limit = query.limit;
    const feedType = query.feedType || 'recommend';

    let feed;
    if (feedType === 'trend') {
      feed = await strapi.service("api::recommendation.trend").getTrendingFeed(
        user,
        limit ? parseInt(String(limit), 10) : 20,
        "problem"
      );
    } else {
      const excludeStr = String(query.excludeIds || '');
      const excludeIdsArray = excludeStr.length > 0 ? excludeStr.split(',') : [];

      feed = await strapi.service("api::recommendation.recommendation").getFeed(
        user,
        limit ? parseInt(String(limit), 10) : 20,
        "problem",
        excludeIdsArray,
        query.populate
      );
    }
    return { data: feed };
  },

  async getLiveStreams(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const query = ctx.query || {};
    const limit = query.limit;
    const feedType = query.feedType || 'recommend';

    let feed;
    if (feedType === 'trend') {
      feed = await strapi.service("api::recommendation.trend").getTrendingFeed(
        user,
        limit ? parseInt(String(limit), 10) : 20,
        "live-stream"
      );
    } else {
      const excludeStr = String(query.excludeIds || '');
      const excludeIdsArray = excludeStr.length > 0 ? excludeStr.split(',') : [];

      feed = await strapi.service("api::recommendation.recommendation").getFeed(
        user,
        limit ? parseInt(String(limit), 10) : 20,
        "live-stream",
        excludeIdsArray,
        query.populate
      );
    }
    return { data: feed };
  },

  async getEvents(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const query = ctx.query || {};
    const limit = query.limit;
    const feedType = query.feedType || 'recommend';

    let feed;
    if (feedType === 'trend') {
      feed = await strapi.service("api::recommendation.trend").getTrendingFeed(
        user,
        limit ? parseInt(limit) : 20,
        "event"
      );
    } else {
      const excludeStr = String(query.excludeIds || '');
      const excludeIdsArray = excludeStr.length > 0 ? excludeStr.split(',') : [];

      feed = await strapi.service("api::recommendation.recommendation").getFeed(
        user,
        limit ? parseInt(limit) : 20,
        "event",
        excludeIdsArray,
        query.populate
      );
    }
    return { data: feed };
  },

  // Tag suggestions for autocomplete
  async suggest(ctx) {
    const { q } = ctx.query;
    const suggestions = await strapi.service("api::recommendation.recommendation").getSuggestions(String(q || ''));
    return { data: suggestions };
  },

  // Tag audience map for CMS analytics
  async getTagAudience(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const result = await strapi.service("api::recommendation.recommendation").getTagAudienceMap();
    return { data: result };
  }
}));
