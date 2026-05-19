'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::github-event.github-event');
