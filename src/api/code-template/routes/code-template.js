"use strict";

/**
 * code-template router
 */

module.exports = {
  routes: [
    // Custom routes
    {
      method: "POST",
      path: "/code-templates/generate/:problemId",
      handler: "code-template.generate",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/code-templates/starter/:problemId/:language",
      handler: "code-template.getStarterCode",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    // Core CRUD routes
    {
      method: "GET",
      path: "/code-templates",
      handler: "code-template.find",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/code-templates/:id",
      handler: "code-template.findOne",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/code-templates",
      handler: "code-template.create",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "PUT",
      path: "/code-templates/:id",
      handler: "code-template.update",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "DELETE",
      path: "/code-templates/:id",
      handler: "code-template.delete",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
