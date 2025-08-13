'use strict';

/**
 * problem-type service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::problem-type.problem-type');
