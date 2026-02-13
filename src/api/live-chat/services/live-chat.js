'use strict';

/**
 * live-chat service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::live-chat.live-chat');
