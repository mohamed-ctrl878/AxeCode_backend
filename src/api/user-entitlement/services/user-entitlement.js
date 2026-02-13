'use strict';

/**
 * user-entitlement service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::user-entitlement.user-entitlement');
