'use strict';

/**
 * idempotency-key controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::idempotency-key.idempotency-key');
