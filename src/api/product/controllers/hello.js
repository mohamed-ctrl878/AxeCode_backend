'use strict';

/**
 * product controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::product.product', () => ({
    async index(ctx,next) {
        ctx.send({mesg:"hello world"})
    }
}));
