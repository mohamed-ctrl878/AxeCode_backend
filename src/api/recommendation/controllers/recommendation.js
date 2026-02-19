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

    const { type, limit } = ctx.query;
    const feed = await strapi.service("api::recommendation.recommendation").getFeed(user, limit ? parseInt(limit) : 20, type);
    return { data: feed };
  },

  // Separate endpoints per content type
  async getArticles(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const { limit } = ctx.query;
    const feed = await strapi.service("api::recommendation.recommendation").getFeed(user, limit ? parseInt(limit) : 20, "article");
    return { data: feed };
  },

  async getBlogs(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const { limit } = ctx.query;
    const feed = await strapi.service("api::recommendation.recommendation").getFeed(user, limit ? parseInt(limit) : 20, "blog");
    return { data: feed };
  },

  async getPosts(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const { limit } = ctx.query;
    const feed = await strapi.service("api::recommendation.recommendation").getFeed(user, limit ? parseInt(limit) : 20, "post");
    return { data: feed };
  },

  async getCourses(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const { limit } = ctx.query;
    const feed = await strapi.service("api::recommendation.recommendation").getFeed(user, limit ? parseInt(limit) : 20, "course");
    return { data: feed };
  },

  async getProblems(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const { limit } = ctx.query;
    const feed = await strapi.service("api::recommendation.recommendation").getFeed(user, limit ? parseInt(limit) : 20, "problem");
    return { data: feed };
  },

  async getLiveStreams(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const { limit } = ctx.query;
    const feed = await strapi.service("api::recommendation.recommendation").getFeed(user, limit ? parseInt(limit) : 20, "live-stream");
    return { data: feed };
  },

  async getEvents(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized("Authentication required");

    const { limit } = ctx.query;
    const feed = await strapi.service("api::recommendation.recommendation").getFeed(user, limit ? parseInt(limit) : 20, "event");
    return { data: feed };
  },

  // Tag suggestions for autocomplete
  async suggest(ctx) {
    const { q } = ctx.query;
    const suggestions = await strapi.service("api::recommendation.recommendation").getSuggestions(q);
    return { data: suggestions };
  }
}));
