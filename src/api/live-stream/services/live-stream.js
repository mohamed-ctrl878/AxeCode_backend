'use strict';

/**
 * live-stream service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::live-stream.live-stream');
