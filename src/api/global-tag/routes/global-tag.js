"use strict";

/**
 * global-tag router
 */

const { createCoreRouter } = require("@strapi/strapi").factories;

module.exports = createCoreRouter("api::global-tag.global-tag");
