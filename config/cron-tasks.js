module.exports = {
  /**
   * Weekly decay of user interests to keep recommendations fresh.
   * Runs every Monday at 00:00.
   */
  "0 0 * * 1": async ({ strapi }) => {
    await strapi.service("api::recommendation.recommendation").applyTimeDecay(0.9);
  },
};
