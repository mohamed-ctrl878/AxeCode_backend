import { describe, it, expect, vi, beforeEach } from 'vitest';
const { createLessonAccessStrategy } = require('../../../src/api/upload-security/strategies/lesson-access-strategy');

// ─── Test Helpers ───

function createMockStrapi(queryResult = null) {
  return {
    db: {
      query: vi.fn(() => ({
        findOne: vi.fn().mockResolvedValue(queryResult),
      })),
    },
  };
}

// ─── Lesson Access Strategy Tests ───

describe('Lesson Access Strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should deny when no documentId provided', async () => {
    const strapi = createMockStrapi();
    const strategy = createLessonAccessStrategy(strapi);

    const result = await strategy(null, 1);

    expect(result).toBe(false);
  });

  it('should deny when no userId provided', async () => {
    const strapi = createMockStrapi();
    const strategy = createLessonAccessStrategy(strapi);

    const result = await strategy('doc-1', null);

    expect(result).toBe(false);
  });

  it('should deny when lesson not found', async () => {
    const strapi = createMockStrapi(null);
    const strategy = createLessonAccessStrategy(strapi);

    const result = await strategy('doc-1', 1);

    expect(result).toBe(false);
  });

  it('should allow when user is the lesson owner', async () => {
    const strapi = createMockStrapi({
      id: 1,
      documentId: 'doc-1',
      users_permissions_user: { id: 5 },
      week: null,
    });
    const strategy = createLessonAccessStrategy(strapi);

    const result = await strategy('doc-1', 5);

    expect(result).toBe(true);
  });

  it('should deny when lesson has no week', async () => {
    const strapi = createMockStrapi({
      id: 1,
      documentId: 'doc-1',
      users_permissions_user: { id: 99 },
      week: null,
    });
    const strategy = createLessonAccessStrategy(strapi);

    const result = await strategy('doc-1', 5);

    expect(result).toBe(false);
  });

  it('should deny when week has no course', async () => {
    const strapi = createMockStrapi({
      id: 1,
      documentId: 'doc-1',
      users_permissions_user: { id: 99 },
      week: { id: 10, course: null },
    });
    const strategy = createLessonAccessStrategy(strapi);

    const result = await strategy('doc-1', 5);

    expect(result).toBe(false);
  });

  it('should allow when user is the course owner', async () => {
    const strapi = createMockStrapi({
      id: 1,
      documentId: 'doc-1',
      users_permissions_user: { id: 99 },  // not the same user
      week: {
        id: 10,
        course: {
          id: 20,
          users_permissions_user: { id: 5 },  // course owner = requesting user
        },
      },
    });
    const strategy = createLessonAccessStrategy(strapi);

    const result = await strategy('doc-1', 5);

    expect(result).toBe(true);
  });

  it('should deny when user is NOT the course owner', async () => {
    const strapi = createMockStrapi({
      id: 1,
      documentId: 'doc-1',
      users_permissions_user: { id: 99 },
      week: {
        id: 10,
        course: {
          id: 20,
          users_permissions_user: { id: 50 },  // different course owner
        },
      },
    });
    const strategy = createLessonAccessStrategy(strapi);

    const result = await strategy('doc-1', 5);

    expect(result).toBe(false);
  });

  it('should query with correct populate chain', async () => {
    const mockFindOne = vi.fn().mockResolvedValue(null);
    const strapi = {
      db: {
        query: vi.fn(() => ({ findOne: mockFindOne })),
      },
    };
    const strategy = createLessonAccessStrategy(strapi);

    await strategy('doc-lesson-1', 1);

    expect(strapi.db.query).toHaveBeenCalledWith('api::lesson.lesson');
    expect(mockFindOne).toHaveBeenCalledWith({
      where: { documentId: 'doc-lesson-1' },
      populate: {
        users_permissions_user: true,
        week: {
          populate: {
            course: {
              populate: {
                users_permissions_user: true,
              },
            },
          },
        },
      },
    });
  });

  it('should deny when lesson owner is null and no week', async () => {
    const strapi = createMockStrapi({
      id: 1,
      documentId: 'doc-1',
      users_permissions_user: null,
      week: null,
    });
    const strategy = createLessonAccessStrategy(strapi);

    const result = await strategy('doc-1', 5);

    expect(result).toBe(false);
  });

  it('should deny when course owner is null', async () => {
    const strapi = createMockStrapi({
      id: 1,
      documentId: 'doc-1',
      users_permissions_user: null,
      week: {
        id: 10,
        course: {
          id: 20,
          users_permissions_user: null,
        },
      },
    });
    const strategy = createLessonAccessStrategy(strapi);

    const result = await strategy('doc-1', 5);

    expect(result).toBe(false);
  });
});
