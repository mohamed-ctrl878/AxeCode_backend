'use strict';

/**
 * Wallet Service
 * 
 * Core financial operations with concurrency control:
 * - Optimistic Locking for CREDIT (normal webhook flow)
 * - Pessimistic Locking for DEBIT (payout/high contention)
 */

const { createCoreService } = require('@strapi/strapi').factories;

/** Custom error classes for wallet operations */
class OptimisticLockError extends Error {
  constructor(message = 'Wallet was modified concurrently') {
    super(message);
    this.name = 'OptimisticLockError';
  }
}

class InsufficientFundsError extends Error {
  constructor(available, requested) {
    super(`Insufficient funds: available=${available}, requested=${requested}`);
    this.name = 'InsufficientFundsError';
    this.available = available;
    this.requested = requested;
  }
}

class WalletInactiveError extends Error {
  constructor(walletId) {
    super(`Wallet ${walletId} is inactive`);
    this.name = 'WalletInactiveError';
  }
}

/** Default commission rate for new publishers (10%) */
const DEFAULT_COMMISSION_RATE = 0.10;

/** Max retry attempts for optimistic lock conflicts */
const MAX_OPTIMISTIC_RETRIES = 3;

module.exports = createCoreService('api::wallet.wallet', ({ strapi }) => ({

  /**
   * Find or create a wallet for a user.
   * Each user (publisher) gets exactly one wallet.
   * Platform has exactly one wallet (owner_type = 'platform').
   */
  async findOrCreateWallet(userId, ownerType = 'publisher', currency = 'EGP') {
    try {
      // Try to find existing wallet
      const existing = await strapi.db.query('api::wallet.wallet').findOne({
        where: ownerType === 'platform'
          ? { owner_type: 'platform' }
          : { owner: userId, owner_type: ownerType },
      });

      if (existing) return existing;

      // Create new wallet
      const walletData = {
        owner_type: ownerType,
        balance: 0,
        pending_balance: 0,
        version: 0,
        currency,
        commission_rate: ownerType === 'platform' ? 0 : DEFAULT_COMMISSION_RATE,
        is_active: true,
      };

      // Link owner only for non-platform wallets
      if (ownerType !== 'platform' && userId) {
        walletData.owner = userId;
      }

      const wallet = await strapi.db.query('api::wallet.wallet').create({
        data: walletData,
      });

      strapi.log.info(`[Wallet] Created ${ownerType} wallet #${wallet.id} for user ${userId || 'SYSTEM'}`);
      return wallet;
    } catch (error) {
      strapi.log.error('[Wallet] findOrCreateWallet failed:', error.message);
      throw error;
    }
  },

  /**
   * Get the platform wallet (singleton).
   * Creates one if it doesn't exist.
   */
  async getPlatformWallet() {
    return this.findOrCreateWallet(null, 'platform');
  },

  /**
   * Get a wallet by its ID with fresh data.
   */
  async getBalance(walletId) {
    const wallet = await strapi.db.query('api::wallet.wallet').findOne({
      where: { id: walletId },
    });

    if (!wallet) throw new Error(`Wallet ${walletId} not found`);

    return {
      balance: parseFloat(wallet.balance),
      pending_balance: parseFloat(wallet.pending_balance),
      available: parseFloat(wallet.balance) - parseFloat(wallet.pending_balance),
      currency: wallet.currency,
      is_active: wallet.is_active,
    };
  },

  /**
   * Get wallet by owner user ID.
   */
  async getWalletByOwner(userId) {
    const wallet = await strapi.db.query('api::wallet.wallet').findOne({
      where: { owner: userId, owner_type: 'publisher' },
    });
    return wallet;
  },

  /**
   * CREDIT a wallet using Optimistic Locking.
   * Used for normal payment flows (webhook → credit publisher).
   * 
   * Retry mechanism: on version conflict, retry up to MAX_OPTIMISTIC_RETRIES
   * with exponential backoff.
   * 
   * @param {number} walletId - The wallet ID
   * @param {number} amount - Amount to credit (must be positive)
   * @param {object} [trx] - Optional Knex transaction
   */
  async creditWallet(walletId, amount, trx = null) {
    if (amount <= 0) throw new Error('Credit amount must be positive');

    const db = trx || strapi.db.connection;

    for (let attempt = 1; attempt <= MAX_OPTIMISTIC_RETRIES; attempt++) {
      // 1. Read current state
      const wallet = await db('wallets').where({ id: walletId }).first();

      if (!wallet) throw new Error(`Wallet ${walletId} not found`);
      if (!wallet.is_active) throw new WalletInactiveError(walletId);

      // 2. Optimistic update — only succeeds if version hasn't changed
      const updated = await db('wallets')
        .where({ id: walletId, version: wallet.version })
        .update({
          balance: parseFloat(wallet.balance) + amount,
          version: wallet.version + 1,
          updated_at: new Date(),
        });

      if (updated > 0) {
        strapi.log.info(`[Wallet] CREDIT wallet #${walletId}: +${amount} (attempt ${attempt})`);
        return { 
          success: true, 
          new_balance: parseFloat(wallet.balance) + amount,
          version: wallet.version + 1,
        };
      }

      // 3. Version conflict — wait and retry
      if (attempt < MAX_OPTIMISTIC_RETRIES) {
        const delay = Math.pow(2, attempt) * 50; // 100ms, 200ms, 400ms
        strapi.log.warn(`[Wallet] Optimistic lock conflict on wallet #${walletId}, retry ${attempt}/${MAX_OPTIMISTIC_RETRIES} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All retries exhausted
    throw new OptimisticLockError(`Failed to credit wallet #${walletId} after ${MAX_OPTIMISTIC_RETRIES} attempts`);
  },

  /**
   * DEBIT a wallet using Pessimistic Locking (SELECT FOR UPDATE).
   * Used for high-contention operations like payouts.
   * 
   * MUST be called within a database transaction.
   * 
   * @param {number} walletId - The wallet ID
   * @param {number} amount - Amount to debit (must be positive)
   * @param {object} trx - Required Knex transaction
   */
  async debitWallet(walletId, amount, trx) {
    if (!trx) throw new Error('debitWallet requires a database transaction');
    if (amount <= 0) throw new Error('Debit amount must be positive');

    // 1. Lock the row — SELECT FOR UPDATE
    const wallet = await trx('wallets')
      .where({ id: walletId })
      .forUpdate()
      .first();

    if (!wallet) throw new Error(`Wallet ${walletId} not found`);
    if (!wallet.is_active) throw new WalletInactiveError(walletId);

    const currentBalance = parseFloat(wallet.balance);
    if (currentBalance < amount) {
      throw new InsufficientFundsError(currentBalance, amount);
    }

    // 2. Debit while row is locked
    await trx('wallets')
      .where({ id: walletId })
      .update({
        balance: currentBalance - amount,
        version: wallet.version + 1,
        updated_at: new Date(),
      });

    strapi.log.info(`[Wallet] DEBIT wallet #${walletId}: -${amount}`);
    return {
      success: true,
      new_balance: currentBalance - amount,
      version: wallet.version + 1,
    };
  },

  /**
   * Get the commission rate for a specific publisher's wallet.
   * Falls back to default if not set.
   */
  async getCommissionRate(walletId) {
    const wallet = await strapi.db.query('api::wallet.wallet').findOne({
      where: { id: walletId },
    });

    if (!wallet) return DEFAULT_COMMISSION_RATE;
    return parseFloat(wallet.commission_rate) || DEFAULT_COMMISSION_RATE;
  },

  /**
   * Update the commission rate for a publisher wallet (Admin only).
   */
  async updateCommissionRate(walletId, newRate) {
    if (newRate < 0 || newRate > 1) {
      throw new Error('Commission rate must be between 0 and 1');
    }

    await strapi.db.query('api::wallet.wallet').update({
      where: { id: walletId },
      data: { commission_rate: newRate },
    });

    strapi.log.info(`[Wallet] Commission rate updated for wallet #${walletId}: ${(newRate * 100).toFixed(1)}%`);
  },

  /** Expose error classes for external use */
  errors: {
    OptimisticLockError,
    InsufficientFundsError,
    WalletInactiveError,
  },
}));
