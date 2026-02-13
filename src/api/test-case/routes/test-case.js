"use strict";

/**
 * test-case router
 */

const { createCoreRouter } = require("@strapi/strapi").factories;

module.exports = createCoreRouter("api::test-case.test-case");
