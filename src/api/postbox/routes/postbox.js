'use strict';

/**
 * postbox router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::postbox.postbox');
