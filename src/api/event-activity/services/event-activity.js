'use strict';

/**
 * event-activity service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::event-activity.event-activity');
