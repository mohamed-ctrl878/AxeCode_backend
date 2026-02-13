import { describe, it, expect, vi, beforeEach } from 'vitest';
const {
  createFileOwnershipMiddleware,
  extractFileIds,
  findMediaFields,
  extractOwnerId,
} = require('../../../src/middlewares/file-ownership-middleware');

// ─── Test Helpers ───

function createMockStrapi({ fileQueryResult = null, contentQueryResult = null } = {}) {
  return {
    requestContext: {
      get: vi.fn(() => ({
        state: { user: { id: 1 } },
      })),
    },
    db: {
      query: vi.fn((uid) => ({
        findOne: vi.fn().mockResolvedValue(
          uid === 'plugin::upload.file' ? fileQueryResult : contentQueryResult
        ),
      })),
    },
  };
}

function createContext({
  action = 'create',
  uid = 'api::article.article',
  data = {},
  attributes = {},
  documentId = undefined,
} = {}) {
  return {
    action,
    uid,
    params: { data, ...(documentId && { documentId }) },
    contentType: { attributes },
  };
}

const next = vi.fn().mockResolvedValue({ id: 1 });

// ─── Unit Tests: extractFileIds ───

describe('extractFileIds', () => {
  it('should return empty array for null/undefined', () => {
    expect(extractFileIds(null)).toEqual([]);
    expect(extractFileIds(undefined)).toEqual([]);
  });

  it('should extract single numeric id', () => {
    expect(extractFileIds(10)).toEqual([10]);
  });

  it('should extract id from object', () => {
    expect(extractFileIds({ id: 5 })).toEqual([5]);
  });

  it('should extract ids from array of numbers', () => {
    expect(extractFileIds([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('should extract ids from array of objects', () => {
    expect(extractFileIds([{ id: 1 }, { id: 2 }])).toEqual([1, 2]);
  });

  it('should handle mixed array', () => {
    expect(extractFileIds([1, { id: 2 }, null])).toEqual([1, 2]);
  });
});

// ─── Unit Tests: findMediaFields ───

describe('findMediaFields', () => {
  it('should return empty array for null', () => {
    expect(findMediaFields(null)).toEqual([]);
  });

  it('should find media fields', () => {
    const attrs = {
      title: { type: 'string' },
      video: { type: 'media' },
      cover: { type: 'media' },
      description: { type: 'richtext' },
    };
    expect(findMediaFields(attrs)).toEqual(['video', 'cover']);
  });

  it('should return empty array if no media fields', () => {
    const attrs = {
      title: { type: 'string' },
      name: { type: 'string' },
    };
    expect(findMediaFields(attrs)).toEqual([]);
  });
});

// ─── Unit Tests: extractOwnerId ───

describe('extractOwnerId', () => {
  it('should return null for null/undefined', () => {
    expect(extractOwnerId(null)).toBeNull();
    expect(extractOwnerId(undefined)).toBeNull();
  });

  it('should extract numeric id', () => {
    expect(extractOwnerId(5)).toBe(5);
  });

  it('should extract id from object', () => {
    expect(extractOwnerId({ id: 3 })).toBe(3);
  });

  it('should extract id from connect format', () => {
    expect(extractOwnerId({ connect: [{ id: 7 }] })).toBe(7);
  });

  it('should return null for unknown format', () => {
    expect(extractOwnerId('invalid')).toBeNull();
  });
});

// ─── Integration Tests: File Ownership ───

describe('File Ownership Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass through for non-create/update actions', async () => {
    const strapi = createMockStrapi();
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({ action: 'findOne' });

    await middleware(context, next);

    expect(next).toHaveBeenCalled();
    expect(strapi.db.query).not.toHaveBeenCalled();
  });

  it('should pass through for upload plugin uid', async () => {
    const strapi = createMockStrapi();
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({ uid: 'plugin::upload.file', action: 'create' });

    await middleware(context, next);

    expect(next).toHaveBeenCalled();
  });

  it('should pass through when no data', async () => {
    const strapi = createMockStrapi();
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({ action: 'create' });
    context.params.data = undefined;

    await middleware(context, next);

    expect(next).toHaveBeenCalled();
  });

  it('should pass through when no user (admin/internal)', async () => {
    const strapi = createMockStrapi();
    strapi.requestContext.get.mockReturnValue({ state: {} });
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({
      action: 'create',
      data: { video: 10 },
      attributes: { video: { type: 'media' } },
    });

    await middleware(context, next);

    expect(next).toHaveBeenCalled();
  });

  it('should pass through when no media fields in schema', async () => {
    const strapi = createMockStrapi();
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({
      action: 'create',
      data: { title: 'Test' },
      attributes: { title: { type: 'string' } },
    });

    await middleware(context, next);

    expect(next).toHaveBeenCalled();
    expect(strapi.db.query).not.toHaveBeenCalled();
  });

  it('should allow when user is the file owner', async () => {
    const strapi = createMockStrapi({ fileQueryResult: { id: 10, owner: 1 } });
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({
      action: 'create',
      data: { video: 10 },
      attributes: { video: { type: 'media' } },
    });

    await middleware(context, next);

    expect(next).toHaveBeenCalled();
  });

  it('should throw when user is NOT the file owner', async () => {
    const strapi = createMockStrapi({ fileQueryResult: { id: 10, owner: 99 } });
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({
      action: 'create',
      data: { video: 10 },
      attributes: { video: { type: 'media' } },
    });

    await expect(middleware(context, next)).rejects.toThrow('Unauthorized');
    expect(next).not.toHaveBeenCalled();
  });

  it('should throw when file does not exist', async () => {
    const strapi = createMockStrapi({ fileQueryResult: null });
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({
      action: 'create',
      data: { video: 999 },
      attributes: { video: { type: 'media' } },
    });

    await expect(middleware(context, next)).rejects.toThrow('not found');
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow files without owner (legacy files)', async () => {
    const strapi = createMockStrapi({ fileQueryResult: { id: 10, owner: null } });
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({
      action: 'create',
      data: { video: 10 },
      attributes: { video: { type: 'media' } },
    });

    await middleware(context, next);

    expect(next).toHaveBeenCalled();
  });

  it('should work with update action too', async () => {
    const strapi = createMockStrapi({ fileQueryResult: { id: 10, owner: 99 } });
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({
      action: 'update',
      data: { video: 10 },
      attributes: { video: { type: 'media' } },
    });

    await expect(middleware(context, next)).rejects.toThrow('Unauthorized');
  });

  it('should skip media fields with no value in data', async () => {
    const strapi = createMockStrapi();
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({
      action: 'create',
      data: { title: 'Test' },
      attributes: { video: { type: 'media' }, title: { type: 'string' } },
    });

    await middleware(context, next);

    expect(next).toHaveBeenCalled();
    expect(strapi.db.query).not.toHaveBeenCalled();
  });
});

// ─── Integration Tests: Content Ownership ───

describe('Content Ownership Checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mediaAttributes = {
    video: { type: 'media' },
    users_permissions_user: { type: 'relation' },
  };

  it('should allow create when user is the content owner', async () => {
    const strapi = createMockStrapi({ fileQueryResult: { id: 10, owner: 1 } });
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({
      action: 'create',
      data: { video: 10, users_permissions_user: 1 },
      attributes: mediaAttributes,
    });

    await middleware(context, next);

    expect(next).toHaveBeenCalled();
  });

  it('should throw on create when trying to set different owner', async () => {
    const strapi = createMockStrapi({ fileQueryResult: { id: 10, owner: 1 } });
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({
      action: 'create',
      data: { video: 10, users_permissions_user: 99 },
      attributes: mediaAttributes,
    });

    await expect(middleware(context, next)).rejects.toThrow('Cannot create');
    expect(next).not.toHaveBeenCalled();
  });

  it('should throw on create when using connect format with wrong user', async () => {
    const strapi = createMockStrapi({ fileQueryResult: { id: 10, owner: 1 } });
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({
      action: 'create',
      data: { video: 10, users_permissions_user: { connect: [{ id: 99 }] } },
      attributes: mediaAttributes,
    });

    await expect(middleware(context, next)).rejects.toThrow('Cannot create');
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow update when user owns the existing content', async () => {
    const strapi = createMockStrapi({
      fileQueryResult: { id: 10, owner: 1 },
      contentQueryResult: { id: 5, documentId: 'doc-5', users_permissions_user: { id: 1 } },
    });
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({
      action: 'update',
      data: { video: 10 },
      attributes: mediaAttributes,
      documentId: 'doc-5',
    });

    await middleware(context, next);

    expect(next).toHaveBeenCalled();
  });

  it('should throw on update when user does NOT own existing content', async () => {
    const strapi = createMockStrapi({
      fileQueryResult: { id: 10, owner: 1 },
      contentQueryResult: { id: 5, documentId: 'doc-5', users_permissions_user: { id: 99 } },
    });
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({
      action: 'update',
      data: { video: 10 },
      attributes: mediaAttributes,
      documentId: 'doc-5',
    });

    await expect(middleware(context, next)).rejects.toThrow('do not own');
    expect(next).not.toHaveBeenCalled();
  });

  it('should skip content ownership check when no owner field in schema', async () => {
    const strapi = createMockStrapi({ fileQueryResult: { id: 10, owner: 1 } });
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({
      action: 'create',
      data: { video: 10 },
      attributes: { video: { type: 'media' } },  // no users_permissions_user
    });

    await middleware(context, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow create when no owner specified in data', async () => {
    const strapi = createMockStrapi({ fileQueryResult: { id: 10, owner: 1 } });
    const middleware = createFileOwnershipMiddleware(strapi);
    const context = createContext({
      action: 'create',
      data: { video: 10 },  // no users_permissions_user in data
      attributes: mediaAttributes,
    });

    await middleware(context, next);

    expect(next).toHaveBeenCalled();
  });
});
