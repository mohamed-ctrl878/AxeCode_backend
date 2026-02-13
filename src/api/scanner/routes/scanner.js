'use strict';

/**
 * scanner router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::scanner.scanner');
