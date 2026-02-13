"use strict";

module.exports = {
  async beforeCreate(event) {
    await strapi.service("api::recommendation.recommendation").handleLifecycleEvent(event);
  },
  async beforeUpdate(event) {
    await strapi.service("api::recommendation.recommendation").handleLifecycleEvent(event);
  },
};
