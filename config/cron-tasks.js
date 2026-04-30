module.exports = {
  /**
   * Weekly decay of user interests to keep recommendations fresh.
   * Runs every Monday at 00:00.
   */
  "0 0 * * 1": async ({ strapi }) => {
    await strapi.service("api::recommendation.recommendation").applyTimeDecay(0.9);
  },

  /**
   * Internal Reconciliation: matches wallet balance with transaction ledger.
   * Runs every hour at minute 0.
   */
  "0 * * * *": async ({ strapi }) => {
    strapi.log.info('[Cron] Triggering Wallet Reconciliation Audit...');
    try {
      await strapi.service('api::wallet.wallet').runInternalReconciliation();
    } catch (err) {
      strapi.log.error(`[Cron] Reconciliation failed: ${err.message}`);
    }
  },
};
