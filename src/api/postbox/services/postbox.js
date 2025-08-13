'use strict';

/**
 * postbox service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::postbox.postbox');
