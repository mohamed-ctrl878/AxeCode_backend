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
    const excludeStr = String(query.excludeIds || '');
    const excludeIdsArray = excludeStr.length > 0 ? excludeStr.split(',') : [];

    const feed = await strapi.service("api::recommendation.recommendation").getFeed(
      user,
      limit ? parseInt(String(limit), 10) : 20,
      type,
      excludeIdsArray
    );
    return { data: feed };
  },

  // Separate endpoints per content type
  async getArticles(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const query = ctx.query || {};
    const limit = query.limit;
    const excludeStr = String(query.excludeIds || '');
    const excludeIdsArray = excludeStr.length > 0 ? excludeStr.split(',') : [];

    const feed = await strapi.service("api::recommendation.recommendation").getFeed(
      user,
      limit ? parseInt(String(limit), 10) : 20,
      "article",
      excludeIdsArray
    );
    return { data: feed };
  },

  async getBlogs(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const query = ctx.query || {};
    const limit = query.limit;
    const excludeStr = String(query.excludeIds || '');
    const excludeIdsArray = excludeStr.length > 0 ? excludeStr.split(',') : [];

    const feed = await strapi.service("api::recommendation.recommendation").getFeed(
      user,
      limit ? parseInt(String(limit), 10) : 20,
      "blog",
      excludeIdsArray
    );
    return { data: feed };
  },

  async getPosts(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const query = ctx.query || {};
    const limit = query.limit;
    const excludeStr = String(query.excludeIds || '');
    const excludeIdsArray = excludeStr.length > 0 ? excludeStr.split(',') : [];

    const feed = await strapi.service("api::recommendation.recommendation").getFeed(
      user,
      limit ? parseInt(String(limit), 10) : 20,
      "post",
      excludeIdsArray
    );
    return { data: feed };
  },

  async getCourses(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const query = ctx.query || {};
    const limit = query.limit;
    const excludeStr = String(query.excludeIds || '');
    const excludeIdsArray = excludeStr.length > 0 ? excludeStr.split(',') : [];

    const feed = await strapi.service("api::recommendation.recommendation").getFeed(
      user,
      limit ? parseInt(String(limit), 10) : 20,
      "course",
      excludeIdsArray
    );
    return { data: feed };
  },

  async getProblems(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const query = ctx.query || {};
    const limit = query.limit;
    const excludeStr = String(query.excludeIds || '');
    const excludeIdsArray = excludeStr.length > 0 ? excludeStr.split(',') : [];

    const feed = await strapi.service("api::recommendation.recommendation").getFeed(
      user,
      limit ? parseInt(String(limit), 10) : 20,
      "problem",
      excludeIdsArray
    );
    return { data: feed };
  },

  async getLiveStreams(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const query = ctx.query || {};
    const limit = query.limit;
    const excludeStr = String(query.excludeIds || '');
    const excludeIdsArray = excludeStr.length > 0 ? excludeStr.split(',') : [];

    const feed = await strapi.service("api::recommendation.recommendation").getFeed(
      user,
      limit ? parseInt(String(limit), 10) : 20,
      "live-stream",
      excludeIdsArray
    );
    return { data: feed };
  },

  async getEvents(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const query = ctx.query || {};
    const limit = query.limit;
    const excludeStr = String(query.excludeIds || '');
    const excludeIdsArray = excludeStr.length > 0 ? excludeStr.split(',') : [];

    const feed = await strapi.service("api::recommendation.recommendation").getFeed(
      user,
      limit ? parseInt(limit) : 20,
      "event",
      excludeIdsArray
    );
    return { data: feed };
  },

  // Tag suggestions for autocomplete
  async suggest(ctx) {
    const { q } = ctx.query;
    const suggestions = await strapi.service("api::recommendation.recommendation").getSuggestions(String(q || ''));
    return { data: suggestions };
  }
}));
