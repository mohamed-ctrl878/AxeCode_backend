'use strict';

/**
 * Transaction Service (Immutable Ledger)
 * 
 * Append-only — no updates or deletes allowed.
 * Every financial movement is recorded as a new entry.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::transaction.transaction', ({ strapi }) => ({

  /**
   * Create a new ledger entry.
   * This is the ONLY way to create transactions — append only.
   * 
   * @param {object} data - Transaction data
   * @param {number} data.wallet - Wallet ID (relation)
   * @param {number} data.amount - Amount (always positive)
   * @param {string} data.type - 'CREDIT' or 'DEBIT'
   * @param {string} data.status - 'PENDING', 'COMPLETED', 'FAILED', 'REVERSED'
   * @param {string} data.reference_type - What triggered this transaction
   * @param {string} [data.reference_id] - ID of the referenced entity
   * @param {string} [data.payment_id] - Paymob transaction ID
   * @param {object} [data.metadata] - Additional context (event_id, ticket_count, etc.)
   * @param {string} [data.description] - Human-readable description
   * @param {object} [trx] - Optional Knex transaction for atomic operations
   */
  async createEntry(data, trx = null) {
    if (!data.wallet) throw new Error('Transaction requires a wallet');
    if (!data.amount || data.amount <= 0) throw new Error('Transaction amount must be positive');
    if (!data.type) throw new Error('Transaction type is required');
    if (!data.reference_type) throw new Error('Transaction reference_type is required');

    const entry = {
      wallet: typeof data.wallet === 'object' ? (data.wallet.id || data.wallet.documentId) : data.wallet,
      amount: data.amount,
      type: data.type,
      status: data.status || 'COMPLETED',
      reference_type: data.reference_type,
      reference_id: data.reference_id || null,
      payment_id: data.payment_id || null,
      metadata: data.metadata || null,
      description: data.description || null,
    };

    let transaction;
    if (trx) {
      // Inside a database transaction — use raw Knex
      // Separate relation fields from actual table columns
      const { wallet, ...rawEntry } = entry;

      const [result] = await trx('transactions').insert({
        ...rawEntry,
        wallet_id: wallet, // Link directly via column (Standard for many-to-one in Strapi/Postgres)
        created_at: new Date(),
        updated_at: new Date(),
      }).returning('*');
      
      transaction = result;

      // Also try join table as fallback if the system is configured that way
      try {
        const hasLinkTable = await trx.schema.hasTable('transactions_wallet_lnk');
        if (hasLinkTable && wallet) {
          await trx('transactions_wallet_lnk').insert({
            transaction_id: transaction.id,
            wallet_id: wallet,
          });
        }
      } catch (e) {
        // Ignore if link table doesn't exist
      }
    } else {
      // Standalone — use Strapi API
      // In Strapi 5, we MUST ensure the relation is handled via the relation system
      transaction = await strapi.db.query('api::transaction.transaction').create({
        data: {
          ...entry,
          wallet: entry.wallet // Strapi's Query Engine handles the link table automatically if passed here
        },
      });

      // DOUBLE CHECK & FORCE LINK: If it's Strapi 5, sometimes we need to use the Document API for relations
      if (transaction) {
        try {
          // Attempt to force the relation link via the Document Service if the above failed
          await strapi.documents('api::transaction.transaction').update({
            documentId: transaction.documentId,
            data: {
              wallet: entry.wallet
            }
          });
          strapi.log.info(`[Ledger] Transaction #${transaction.id} linked to wallet ${entry.wallet} successfully.`);
        } catch (linkErr) {
          strapi.log.warn(`[Ledger] Document link update failed (might be already linked): ${linkErr.message}`);
        }
      }
    }

    strapi.log.info(
      `[Ledger] ${entry.type} ${entry.amount} → wallet #${entry.wallet} | ${entry.reference_type} | status=${entry.status}`
    );

    return transaction;
  },

  /**
   * Find transactions for a specific wallet with pagination and filters.
   */
  async findByWallet(walletId, { page = 1, pageSize = 25, type, status, reference_type } = {}) {
    const where = { wallet: walletId };

    if (type) where.type = type;
    if (status) where.status = status;
    if (reference_type) where.reference_type = reference_type;

    const [entries, count] = await Promise.all([
      strapi.db.query('api::transaction.transaction').findMany({
        where,
        orderBy: { createdAt: 'desc' },
        offset: (page - 1) * pageSize,
        limit: pageSize,
        populate: ['wallet'],
      }),
      strapi.db.query('api::transaction.transaction').count({ where }),
    ]);

    return {
      data: entries,
      pagination: {
        page,
        pageSize,
        pageCount: Math.ceil(count / pageSize),
        total: count,
      },
    };
  },

  /**
   * Calculate the actual balance from the ledger (for reconciliation).
   * SUM(CREDIT) - SUM(DEBIT) where status = COMPLETED
   * 
   * This should match wallet.balance — if not, there's a discrepancy.
   */
  async calculateBalance(walletId) {
    const result = await strapi.db.connection('transactions')
      .where({ wallet: walletId, status: 'COMPLETED' })
      .select(
        strapi.db.connection.raw(`
          COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0) as total_credits,
          COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0) as total_debits
        `)
      )
      .first();

    const totalCredits = parseFloat(result.total_credits) || 0;
    const totalDebits = parseFloat(result.total_debits) || 0;

    return {
      total_credits: totalCredits,
      total_debits: totalDebits,
      calculated_balance: totalCredits - totalDebits,
    };
  },

  /**
   * Get a summary of transactions for a wallet (used in dashboard).
   */
  async getWalletSummary(walletId) {
    const [balanceInfo, recentTransactions] = await Promise.all([
      this.calculateBalance(walletId),
      this.findByWallet(walletId, { page: 1, pageSize: 10 }),
    ]);

    return {
      ...balanceInfo,
      recent: recentTransactions.data,
      total_transactions: recentTransactions.pagination.total,
    };
  },
}));
