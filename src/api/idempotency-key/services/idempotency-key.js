'use strict';

/**
 * Idempotency Key Service
 * 
 * Ensures each payment webhook is processed exactly once.
 * Keys expire after 7 days and are cleaned up by cron.
 */

const { createCoreService } = require('@strapi/strapi').factories;

/** Key expiration duration in milliseconds (7 days) */
const KEY_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

module.exports = createCoreService('api::idempotency-key.idempotency-key', ({ strapi }) => ({

  /**
   * Find an idempotency key by its value.
   * 
   * @param {string} key - The unique key (Paymob transaction ID)
   * @returns {object|null} The idempotency key record or null
   */
  async findByKey(key) {
    if (!key) return null;

    return strapi.db.query('api::idempotency-key.idempotency-key').findOne({
      where: { key: String(key) },
    });
  },

  /**
   * Mark a key as PROCESSING (beginning of webhook handling).
   * Creates the key if it doesn't exist.
   * 
   * @param {string} key - The unique key
   * @param {object} [trx] - Optional Knex transaction
   */
  async markProcessing(key, trx = null) {
    const expiresAt = new Date(Date.now() + KEY_EXPIRY_MS);

    const data = {
      key: String(key),
      status: 'PROCESSING',
      expires_at: expiresAt,
      result_payload: null,
      processed_at: null,
    };

    if (trx) {
      // Inside a DB transaction — use raw Knex with upsert
      const existing = await trx('idempotency_keys').where({ key: String(key) }).first();

      if (existing) {
        await trx('idempotency_keys')
          .where({ key: String(key) })
          .update({ status: 'PROCESSING', updated_at: new Date() });
        return existing;
      }

      const [result] = await trx('idempotency_keys').insert({
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
      }).returning('*');
      return result;
    }

    // Standalone — use Strapi API
    const existing = await this.findByKey(key);
    if (existing) {
      return strapi.db.query('api::idempotency-key.idempotency-key').update({
        where: { id: existing.id },
        data: { status: 'PROCESSING' },
      });
    }

    return strapi.db.query('api::idempotency-key.idempotency-key').create({ data });
  },

  /**
   * Mark a key as COMPLETED with the result payload.
   * The result_payload allows us to return cached responses for duplicate requests.
   * 
   * @param {string} key - The unique key
   * @param {object} resultPayload - The response to cache
   * @param {object} [trx] - Optional Knex transaction
   */
  async markCompleted(key, resultPayload, trx = null) {
    const updateData = {
      status: 'COMPLETED',
      result_payload: resultPayload,
      processed_at: new Date(),
    };

    if (trx) {
      await trx('idempotency_keys')
        .where({ key: String(key) })
        .update({ ...updateData, updated_at: new Date() });
      return;
    }

    const existing = await this.findByKey(key);
    if (existing) {
      await strapi.db.query('api::idempotency-key.idempotency-key').update({
        where: { id: existing.id },
        data: updateData,
      });
    }
  },

  /**
   * Mark a key as FAILED.
   * 
   * @param {string} key - The unique key
   * @param {object} [trx] - Optional Knex transaction
   */
  async markFailed(key, trx = null) {
    const updateData = {
      status: 'FAILED',
      processed_at: new Date(),
    };

    if (trx) {
      await trx('idempotency_keys')
        .where({ key: String(key) })
        .update({ ...updateData, updated_at: new Date() });
      return;
    }

    const existing = await this.findByKey(key);
    if (existing) {
      await strapi.db.query('api::idempotency-key.idempotency-key').update({
        where: { id: existing.id },
        data: updateData,
      });
    }
  },

  /**
   * Cleanup expired idempotency keys (older than 7 days).
   * Called by cron job daily.
   * 
   * @returns {number} Number of keys deleted
   */
  async cleanupExpired() {
    const now = new Date();

    const result = await strapi.db.query('api::idempotency-key.idempotency-key').deleteMany({
      where: {
        expires_at: { $lt: now },
      },
    });

    const count = result?.count || 0;
    if (count > 0) {
      strapi.log.info(`[Idempotency] Cleaned up ${count} expired keys`);
    }

    return count;
  },
}));
