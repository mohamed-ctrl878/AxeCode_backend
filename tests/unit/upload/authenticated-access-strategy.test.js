import { describe, it, expect } from 'vitest';
const { createAuthenticatedAccessStrategy } = require('../../../src/api/upload-security/strategies/authenticated-access-strategy');

describe('Authenticated Access Strategy', () => {
  const strategy = createAuthenticatedAccessStrategy();

  it('should allow when userId is provided', async () => {
    const result = await strategy('doc-1', 1);
    expect(result).toBe(true);
  });

  it('should allow for any valid userId', async () => {
    const result = await strategy('doc-999', 42);
    expect(result).toBe(true);
  });

  it('should deny when userId is null', async () => {
    const result = await strategy('doc-1', null);
    expect(result).toBe(false);
  });

  it('should deny when userId is undefined', async () => {
    const result = await strategy('doc-1', undefined);
    expect(result).toBe(false);
  });

  it('should deny when userId is 0', async () => {
    const result = await strategy('doc-1', 0);
    expect(result).toBe(false);
  });

  it('should not depend on documentId', async () => {
    const result = await strategy(null, 5);
    expect(result).toBe(true);
  });
});
