"use strict";

/**
 * test-case controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::test-case.test-case");
