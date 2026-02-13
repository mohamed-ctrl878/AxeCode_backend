"use strict";

/**
 * test-case service
 */

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService("api::test-case.test-case");
