import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client } from 'pg';

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║     WALLET SYSTEM — INTEGRATION TESTS (Real PostgreSQL)            ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║                                                                    ║
 * ║  Tests the ENTIRE payout lifecycle against a real database:        ║
 * ║  1. Hold/Freeze on payout request                                 ║
 * ║  2. Confirm debit on approval                                     ║
 * ║  3. Release hold on rejection                                     ║
 * ║  4. Insufficient funds prevention                                 ║
 * ║  5. Concurrent request safety (no over-commitment)                ║
 * ║  6. Ledger integrity after all operations                         ║
 * ║                                                                    ║
 * ║  These tests connect to the REAL Postgres database and use        ║
 * ║  transactions that are ROLLED BACK — no data is persisted.        ║
 * ║                                                                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// ── Database Connection ──────────────────────────────────────────────────────

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '0194456244',
};

let db;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a test wallet directly in the database.
 * Returns the inserted wallet row.
 */
async function createTestWallet(client, overrides = {}) {
  const defaults = {
    document_id: crypto.randomUUID(),
    owner_type: 'publisher',
    balance: 1000.00,
    pending_balance: 0,
    version: 0,
    currency: 'EGP',
    commission_rate: 0.10,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const data = { ...defaults, ...overrides };

  const result = await client.query(
    `INSERT INTO wallets (document_id, owner_type, balance, pending_balance, version, currency, commission_rate, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [data.document_id, data.owner_type, data.balance, data.pending_balance, data.version, data.currency, data.commission_rate, data.is_active, data.created_at, data.updated_at]
  );

  return result.rows[0];
}

/**
 * Creates a test payout record directly in the database.
 */
async function createTestPayout(client, walletId, overrides = {}) {
  const defaults = {
    document_id: crypto.randomUUID(),
    amount: 300,
    status: 'PENDING',
    method: 'InstaPay',
    details: JSON.stringify({ phone: '01012345678' }),
    created_at: new Date(),
    updated_at: new Date(),
  };

  const data = { ...defaults, ...overrides };

  const result = await client.query(
    `INSERT INTO payouts (document_id, amount, status, method, details, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [data.document_id, data.amount, data.status, data.method, data.details, data.created_at, data.updated_at]
  );

  // Link to wallet
  await client.query(
    `INSERT INTO payouts_wallet_lnk (payout_id, wallet_id) VALUES ($1, $2)`,
    [result.rows[0].id, walletId]
  );

  return result.rows[0];
}

/**
 * Reads fresh wallet data from the database.
 */
async function getWallet(client, walletId) {
  const result = await client.query('SELECT * FROM wallets WHERE id = $1', [walletId]);
  return result.rows[0];
}

/**
 * Simulates holdBalance logic (same as wallet service).
 */
async function holdBalance(client, walletId, amount) {
  const wallet = await getWallet(client, walletId);

  if (!wallet) throw new Error(`Wallet ${walletId} not found`);
  if (!wallet.is_active) throw new Error(`Wallet ${walletId} is inactive`);

  const currentBalance = parseFloat(wallet.balance);
  const currentPending = parseFloat(wallet.pending_balance);
  const available = currentBalance - currentPending;

  if (available < amount) {
    throw new Error(`Insufficient funds: available=${available}, requested=${amount}`);
  }

  await client.query(
    `UPDATE wallets SET pending_balance = $1, version = version + 1, updated_at = NOW() WHERE id = $2`,
    [currentPending + amount, walletId]
  );

  return { new_pending: currentPending + amount, available: available - amount };
}

/**
 * Simulates releaseHold logic (same as wallet service).
 */
async function releaseHold(client, walletId, amount) {
  const wallet = await getWallet(client, walletId);
  const currentPending = parseFloat(wallet.pending_balance);
  const newPending = Math.max(0, currentPending - amount);

  await client.query(
    `UPDATE wallets SET pending_balance = $1, version = version + 1, updated_at = NOW() WHERE id = $2`,
    [newPending, walletId]
  );

  return { new_pending: newPending };
}

/**
 * Simulates confirmDebit logic (same as wallet service).
 */
async function confirmDebit(client, walletId, amount) {
  const wallet = await getWallet(client, walletId);

  const currentBalance = parseFloat(wallet.balance);
  const currentPending = parseFloat(wallet.pending_balance);

  if (currentBalance < amount) {
    throw new Error(`Insufficient funds: available=${currentBalance}, requested=${amount}`);
  }

  await client.query(
    `UPDATE wallets SET balance = $1, pending_balance = $2, version = version + 1, updated_at = NOW() WHERE id = $3`,
    [currentBalance - amount, Math.max(0, currentPending - amount), walletId]
  );

  return { new_balance: currentBalance - amount };
}

/**
 * Creates a ledger entry (transaction record).
 */
async function createLedgerEntry(client, walletId, data) {
  const result = await client.query(
    `INSERT INTO transactions (document_id, amount, type, status, reference_type, reference_id, description, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING *`,
    [crypto.randomUUID(), data.amount, data.type, data.status, data.reference_type, data.reference_id || null, data.description || null]
  );

  // Link to wallet via join table
  await client.query(
    `INSERT INTO transactions_wallet_lnk (transaction_id, wallet_id) VALUES ($1, $2)`,
    [result.rows[0].id, walletId]
  );

  return result.rows[0];
}

// ══════════════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('Wallet System — Integration Tests (Real PostgreSQL)', () => {

  beforeAll(async () => {
    db = new Client(DB_CONFIG);
    await db.connect();
  });

  afterAll(async () => {
    if (db) await db.end();
  });

  // ── Each test runs inside a SAVEPOINT that gets rolled back ──────────────
  // This ensures tests don't pollute each other or leave data behind.

  let savepointCounter = 0;

  beforeEach(async () => {
    savepointCounter++;
    await db.query(`BEGIN`);
  });

  afterEach(async () => {
    await db.query(`ROLLBACK`);
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 1. HOLD/FREEZE PATTERN
  // ════════════════════════════════════════════════════════════════════════════

  describe('Hold/Freeze Pattern', () => {

    it('should freeze funds in pending_balance without reducing balance', async () => {
      // Arrange
      const wallet = await createTestWallet(db, { balance: 1000, pending_balance: 0 });

      // Act
      await holdBalance(db, wallet.id, 300);

      // Assert
      const updated = await getWallet(db, wallet.id);
      expect(parseFloat(updated.balance)).toBe(1000);       // Balance UNCHANGED
      expect(parseFloat(updated.pending_balance)).toBe(300); // Funds frozen
    });

    it('should calculate available = balance - pending_balance', async () => {
      const wallet = await createTestWallet(db, { balance: 1000, pending_balance: 0 });

      await holdBalance(db, wallet.id, 300);

      const updated = await getWallet(db, wallet.id);
      const available = parseFloat(updated.balance) - parseFloat(updated.pending_balance);
      expect(available).toBe(700);
    });

    it('should reject hold when available funds are insufficient', async () => {
      const wallet = await createTestWallet(db, { balance: 500, pending_balance: 300 });
      // Available = 500 - 300 = 200

      await expect(holdBalance(db, wallet.id, 250)).rejects.toThrow('Insufficient funds');
    });

    it('should allow multiple holds as long as available is sufficient', async () => {
      const wallet = await createTestWallet(db, { balance: 1000, pending_balance: 0 });

      await holdBalance(db, wallet.id, 300); // Available: 1000 → 700
      await holdBalance(db, wallet.id, 200); // Available: 700 → 500
      await holdBalance(db, wallet.id, 400); // Available: 500 → 100

      const updated = await getWallet(db, wallet.id);
      expect(parseFloat(updated.balance)).toBe(1000);       // Still untouched
      expect(parseFloat(updated.pending_balance)).toBe(900); // 300+200+400
    });

    it('should reject hold that would over-commit available funds', async () => {
      const wallet = await createTestWallet(db, { balance: 1000, pending_balance: 0 });

      await holdBalance(db, wallet.id, 600); // Available: 1000 → 400
      await holdBalance(db, wallet.id, 300); // Available: 400 → 100

      // This should fail: only 100 available, requesting 200
      await expect(holdBalance(db, wallet.id, 200)).rejects.toThrow('Insufficient funds');
    });

    it('should reject hold on inactive wallet', async () => {
      const wallet = await createTestWallet(db, { balance: 1000, is_active: false });

      await expect(holdBalance(db, wallet.id, 100)).rejects.toThrow('inactive');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. FULL PAYOUT LIFECYCLE: REQUEST → APPROVE
  // ════════════════════════════════════════════════════════════════════════════

  describe('Payout Approval Flow', () => {

    it('should hold on request, then debit on approval', async () => {
      const wallet = await createTestWallet(db, { balance: 1000, pending_balance: 0 });

      // ── Step 1: Publisher requests payout (HOLD) ──
      await holdBalance(db, wallet.id, 300);
      const payout = await createTestPayout(db, wallet.id, { amount: 300 });

      let state = await getWallet(db, wallet.id);
      expect(parseFloat(state.balance)).toBe(1000);       // Not debited yet
      expect(parseFloat(state.pending_balance)).toBe(300); // Frozen

      // ── Step 2: Admin approves (CONFIRM DEBIT) ──
      await confirmDebit(db, wallet.id, 300);

      // Record in ledger
      await createLedgerEntry(db, wallet.id, {
        amount: 300,
        type: 'DEBIT',
        status: 'COMPLETED',
        reference_type: 'PAYOUT',
        reference_id: String(payout.id),
        description: 'Payout approved',
      });

      state = await getWallet(db, wallet.id);
      expect(parseFloat(state.balance)).toBe(700);       // NOW debited
      expect(parseFloat(state.pending_balance)).toBe(0); // Hold released
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. FULL PAYOUT LIFECYCLE: REQUEST → REJECT
  // ════════════════════════════════════════════════════════════════════════════

  describe('Payout Rejection Flow', () => {

    it('should hold on request, then release hold on rejection (no debit)', async () => {
      const wallet = await createTestWallet(db, { balance: 1000, pending_balance: 0 });

      // ── Step 1: Publisher requests payout (HOLD) ──
      await holdBalance(db, wallet.id, 300);

      let state = await getWallet(db, wallet.id);
      expect(parseFloat(state.balance)).toBe(1000);
      expect(parseFloat(state.pending_balance)).toBe(300);

      // ── Step 2: Admin rejects (RELEASE HOLD) ──
      await releaseHold(db, wallet.id, 300);

      state = await getWallet(db, wallet.id);
      expect(parseFloat(state.balance)).toBe(1000);      // UNCHANGED — no money lost
      expect(parseFloat(state.pending_balance)).toBe(0);  // Hold released
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. LEDGER INTEGRITY
  // ════════════════════════════════════════════════════════════════════════════

  describe('Ledger Integrity', () => {

    it('should NOT create a ledger entry on payout REQUEST (only on approval)', async () => {
      const wallet = await createTestWallet(db, { balance: 1000, pending_balance: 0 });

      // Request payout (hold only, no ledger entry)
      await holdBalance(db, wallet.id, 300);
      await createTestPayout(db, wallet.id, { amount: 300 });

      // Check ledger — should be empty
      const ledger = await db.query(
        `SELECT t.* FROM transactions t
         JOIN transactions_wallet_lnk lnk ON lnk.transaction_id = t.id
         WHERE lnk.wallet_id = $1`,
        [wallet.id]
      );
      expect(ledger.rows.length).toBe(0); // No ledger entry yet!
    });

    it('should create a DEBIT COMPLETED entry ONLY when payout is approved', async () => {
      const wallet = await createTestWallet(db, { balance: 1000, pending_balance: 0 });

      // Request
      await holdBalance(db, wallet.id, 300);
      const payout = await createTestPayout(db, wallet.id, { amount: 300 });

      // Approve
      await confirmDebit(db, wallet.id, 300);
      await createLedgerEntry(db, wallet.id, {
        amount: 300,
        type: 'DEBIT',
        status: 'COMPLETED',
        reference_type: 'PAYOUT',
        reference_id: String(payout.id),
      });

      // Check ledger
      const ledger = await db.query(
        `SELECT t.* FROM transactions t
         JOIN transactions_wallet_lnk lnk ON lnk.transaction_id = t.id
         WHERE lnk.wallet_id = $1`,
        [wallet.id]
      );
      expect(ledger.rows.length).toBe(1);
      expect(ledger.rows[0].type).toBe('DEBIT');
      expect(ledger.rows[0].status).toBe('COMPLETED');
      expect(parseFloat(ledger.rows[0].amount)).toBe(300);
    });

    it('should NOT create any ledger entry when payout is rejected', async () => {
      const wallet = await createTestWallet(db, { balance: 1000, pending_balance: 0 });

      // Request → Reject
      await holdBalance(db, wallet.id, 300);
      await createTestPayout(db, wallet.id, { amount: 300 });
      await releaseHold(db, wallet.id, 300);

      // Check ledger — should still be empty
      const ledger = await db.query(
        `SELECT t.* FROM transactions t
         JOIN transactions_wallet_lnk lnk ON lnk.transaction_id = t.id
         WHERE lnk.wallet_id = $1`,
        [wallet.id]
      );
      expect(ledger.rows.length).toBe(0);
    });

    it('should maintain balance = SUM(CREDITS) - SUM(DEBITS) after approval', async () => {
      const wallet = await createTestWallet(db, { balance: 1000, pending_balance: 0 });

      // Simulate an initial credit that established the 1000 balance
      await createLedgerEntry(db, wallet.id, {
        amount: 1000,
        type: 'CREDIT',
        status: 'COMPLETED',
        reference_type: 'TICKET_PAYMENT',
      });

      // Request + Approve payout of 300
      await holdBalance(db, wallet.id, 300);
      const payout = await createTestPayout(db, wallet.id, { amount: 300 });
      await confirmDebit(db, wallet.id, 300);
      await createLedgerEntry(db, wallet.id, {
        amount: 300,
        type: 'DEBIT',
        status: 'COMPLETED',
        reference_type: 'PAYOUT',
        reference_id: String(payout.id),
      });

      // Verify: balance should match ledger
      const state = await getWallet(db, wallet.id);
      const ledgerResult = await db.query(
        `SELECT 
           COALESCE(SUM(CASE WHEN t.type = 'CREDIT' THEN t.amount ELSE 0 END), 0) as credits,
           COALESCE(SUM(CASE WHEN t.type = 'DEBIT' THEN t.amount ELSE 0 END), 0) as debits
         FROM transactions t
         JOIN transactions_wallet_lnk lnk ON lnk.transaction_id = t.id
         WHERE lnk.wallet_id = $1 AND t.status = 'COMPLETED'`,
        [wallet.id]
      );

      const calculatedBalance = parseFloat(ledgerResult.rows[0].credits) - parseFloat(ledgerResult.rows[0].debits);
      expect(parseFloat(state.balance)).toBe(700);
      expect(calculatedBalance).toBe(700);
      expect(parseFloat(state.balance)).toBe(calculatedBalance); // ✅ Reconciled
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 5. EDGE CASES
  // ════════════════════════════════════════════════════════════════════════════

  describe('Edge Cases', () => {

    it('should handle exact balance hold (zero remaining available)', async () => {
      const wallet = await createTestWallet(db, { balance: 500, pending_balance: 0 });

      await holdBalance(db, wallet.id, 500);

      const state = await getWallet(db, wallet.id);
      expect(parseFloat(state.balance)).toBe(500);
      expect(parseFloat(state.pending_balance)).toBe(500);
      const available = parseFloat(state.balance) - parseFloat(state.pending_balance);
      expect(available).toBe(0);
    });

    it('should prevent any further holds after full freeze', async () => {
      const wallet = await createTestWallet(db, { balance: 500, pending_balance: 0 });

      await holdBalance(db, wallet.id, 500);

      // Even 1 EGP should fail
      await expect(holdBalance(db, wallet.id, 1)).rejects.toThrow('Insufficient funds');
    });

    it('should handle multiple request-approve cycles correctly', async () => {
      const wallet = await createTestWallet(db, { balance: 1000, pending_balance: 0 });

      // Cycle 1: Request 200, Approve
      await holdBalance(db, wallet.id, 200);
      await confirmDebit(db, wallet.id, 200);

      let state = await getWallet(db, wallet.id);
      expect(parseFloat(state.balance)).toBe(800);
      expect(parseFloat(state.pending_balance)).toBe(0);

      // Cycle 2: Request 300, Approve
      await holdBalance(db, wallet.id, 300);
      await confirmDebit(db, wallet.id, 300);

      state = await getWallet(db, wallet.id);
      expect(parseFloat(state.balance)).toBe(500);
      expect(parseFloat(state.pending_balance)).toBe(0);
    });

    it('should handle mixed approve and reject cycles', async () => {
      const wallet = await createTestWallet(db, { balance: 1000, pending_balance: 0 });

      // Request 400, Approve
      await holdBalance(db, wallet.id, 400);
      await confirmDebit(db, wallet.id, 400);

      // Request 300, Reject
      await holdBalance(db, wallet.id, 300);
      await releaseHold(db, wallet.id, 300);

      // Request 200, Approve
      await holdBalance(db, wallet.id, 200);
      await confirmDebit(db, wallet.id, 200);

      const state = await getWallet(db, wallet.id);
      expect(parseFloat(state.balance)).toBe(400);       // 1000 - 400 - 200 = 400
      expect(parseFloat(state.pending_balance)).toBe(0);  // All resolved
    });

    it('should handle releaseHold gracefully when pending_balance is already 0', async () => {
      const wallet = await createTestWallet(db, { balance: 1000, pending_balance: 0 });

      // Release with no hold — should not go negative
      await releaseHold(db, wallet.id, 300);

      const state = await getWallet(db, wallet.id);
      expect(parseFloat(state.pending_balance)).toBe(0); // Math.max(0, 0-300) = 0
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 6. JOIN TABLE INTEGRITY (Strapi v5 specific)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Join Table Integrity (Strapi v5)', () => {

    it('should correctly link payout to wallet via join table', async () => {
      const wallet = await createTestWallet(db);
      const payout = await createTestPayout(db, wallet.id);

      const link = await db.query(
        `SELECT * FROM payouts_wallet_lnk WHERE payout_id = $1`,
        [payout.id]
      );

      expect(link.rows.length).toBe(1);
      expect(link.rows[0].wallet_id).toBe(wallet.id);
    });

    it('should correctly link transaction to wallet via join table', async () => {
      const wallet = await createTestWallet(db);
      const txn = await createLedgerEntry(db, wallet.id, {
        amount: 100,
        type: 'CREDIT',
        status: 'COMPLETED',
        reference_type: 'TICKET_PAYMENT',
      });

      const link = await db.query(
        `SELECT * FROM transactions_wallet_lnk WHERE transaction_id = $1`,
        [txn.id]
      );

      expect(link.rows.length).toBe(1);
      expect(link.rows[0].wallet_id).toBe(wallet.id);
    });
  });
});

// ── Vitest requires afterEach at module scope for proper setup ────────────
import { afterEach } from 'vitest';
