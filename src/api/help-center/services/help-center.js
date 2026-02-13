'use strict';

/**
 * help-center service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::help-center.help-center');
