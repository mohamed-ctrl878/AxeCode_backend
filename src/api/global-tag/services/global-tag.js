"use strict";

/**
 * global-tag service
 */

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService("api::global-tag.global-tag");
