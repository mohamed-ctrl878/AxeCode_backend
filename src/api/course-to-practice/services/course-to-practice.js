'use strict';

/**
 * course-to-practice service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::course-to-practice.course-to-practice');
