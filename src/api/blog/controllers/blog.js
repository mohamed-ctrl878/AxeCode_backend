'use strict';

/**
 * blog controller
 * Custom controller with ownership checks and auto-publisher assignment
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::blog.blog', ({ strapi }) => ({
  // Override create to auto-set publisher from authenticated user
  async create(ctx) {
    const user = ctx.state.user;
    
    if (!user) {
      return ctx.unauthorized('You must be logged in to create a blog post');
    }

    // Auto-set publisher from authenticated user (not from payload)
    ctx.request.body.data = {
      ...ctx.request.body.data,
      publisher: user.id,
    };

    const response = await super.create(ctx);
    return response;
  },

  // Override update to check ownership
  async update(ctx) {
    const { id } = ctx.params;
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in to update a blog post');
    }

    // Find the blog and check ownership
    const blog = await strapi.documents('api::blog.blog').findOne({
      documentId: id,
      populate: ['publisher'],
    });

    if (!blog) {
      return ctx.notFound('Blog post not found');
    }

    if (blog.publisher?.id !== user.id) {
      return ctx.forbidden('You can only edit your own blog posts');
    }

    const response = await super.update(ctx);
    return response;
  },

  // Override delete to check ownership
  async delete(ctx) {
    const { id } = ctx.params;
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in to delete a blog post');
    }

    // Find the blog and check ownership
    const blog = await strapi.documents('api::blog.blog').findOne({
      documentId: id,
      populate: ['publisher'],
    });

    if (!blog) {
      return ctx.notFound('Blog post not found');
    }

    if (blog.publisher?.id !== user.id) {
      return ctx.forbidden('You can only delete your own blog posts');
    }

    const response = await super.delete(ctx);
    return response;
  },

  // Custom find with interaction enrichment
  async find(ctx) {
    const userId = ctx.state.user?.id || null;
    const { results, pagination } = await strapi.service('api::blog.blog').findForUser(ctx.query, userId);
    
    return { data: results, meta: { pagination } };
  },

  // Override findOne to include interaction enrichment
  async findOne(ctx) {
    const { id } = ctx.params;
    const userId = ctx.state.user?.id || null;
    
    const blog = await strapi.service('api::blog.blog').findOneForUser(id, userId);
    if (!blog) return ctx.notFound('Blog post not found');

    return { data: blog };
  },
}));
