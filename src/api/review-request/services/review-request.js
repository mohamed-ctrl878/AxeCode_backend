'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::review-request.review-request');
