import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

let dbClient;

describe('Real Database Integration (PostgreSQL + TestContainers)', () => {
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      console.warn('TestContainers not running. Skipping DB test.');
      return;
    }
    
    // Connect a real Postgres client to the TestContainer
    dbClient = new Client({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    
    await dbClient.connect();
    
    // Create a real table simulating Strapi's behavior
    await dbClient.query(`
      CREATE TABLE test_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL
      );
    `);
  });

  afterAll(async () => {
    if (dbClient) {
      await dbClient.query('DROP TABLE IF EXISTS test_users');
      await dbClient.end();
    }
  });

  it('verifies creating a user and native PostgreSQL constraints (UNIQUE)', async () => {
    if (!process.env.TEST_DATABASE_URL) return;

    // 1. Insert a new user into the real PostgreSQL database
    const insertRes = await dbClient.query(
      'INSERT INTO test_users(username, email) VALUES($1, $2) RETURNING id, username',
      ['integration-user', 'integration@test.com']
    );

    expect(insertRes.rows[0].id).toBeDefined();
    expect(insertRes.rows[0].username).toBe('integration-user');

    // 2. Test PostgreSQL Foreign Constraints (UNIQUE EMAIL)
    // In MockDB, this might pass. In a Real DB, it MUST fail!
    await expect(
      dbClient.query(
        'INSERT INTO test_users(username, email) VALUES($1, $2)',
        ['another-user', 'integration@test.com']
      )
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });
});
