import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Access Strategy Registry', () => {
  let registry;
  let mockStrapi;

  beforeEach(() => {
    vi.resetModules();
    mockStrapi = {
      log: {
        info: vi.fn(),
        debug: vi.fn(),
      },
    };
    const createRegistry = require('../../../src/api/upload-security/services/access-strategy-registry');
    registry = createRegistry({ strapi: mockStrapi });
  });

  // ─── register ───

  describe('register', () => {
    it('should register a strategy for a content type', () => {
      const strategy = vi.fn();
      registry.register('api::course.course', strategy);

      expect(registry.hasStrategy('api::course.course')).toBe(true);
    });

    it('should throw if strategy is not a function', () => {
      expect(() => registry.register('api::course.course', 'not-a-fn')).toThrow(
        'must be a function'
      );
    });

    it('should log on registration', () => {
      registry.register('api::course.course', vi.fn());
      expect(mockStrapi.log.info).toHaveBeenCalledWith(
        expect.stringContaining('api::course.course')
      );
    });
  });

  // ─── canAccess ───

  describe('canAccess', () => {
    it('should default to ALLOW when no strategy registered', async () => {
      const result = await registry.canAccess('api::unknown.unknown', 'doc-1', 1);
      expect(result).toBe(true);
    });

    it('should call registered strategy', async () => {
      const strategy = vi.fn().mockResolvedValue(false);
      registry.register('api::course.course', strategy);

      const result = await registry.canAccess('api::course.course', 'doc-1', 1);

      expect(strategy).toHaveBeenCalledWith('doc-1', 1);
      expect(result).toBe(false);
    });

    it('should return true when strategy allows', async () => {
      registry.register('api::course.course', vi.fn().mockResolvedValue(true));

      const result = await registry.canAccess('api::course.course', 'doc-1', 1);
      expect(result).toBe(true);
    });

    it('should return false when strategy denies', async () => {
      registry.register('api::course.course', vi.fn().mockResolvedValue(false));

      const result = await registry.canAccess('api::course.course', 'doc-1', 1);
      expect(result).toBe(false);
    });
  });

  // ─── getRegisteredTypes ───

  describe('getRegisteredTypes', () => {
    it('should return empty array initially', () => {
      expect(registry.getRegisteredTypes()).toEqual([]);
    });

    it('should return registered content types', () => {
      registry.register('api::course.course', vi.fn());
      registry.register('api::article.article', vi.fn());

      const types = registry.getRegisteredTypes();
      expect(types).toContain('api::course.course');
      expect(types).toContain('api::article.article');
      expect(types).toHaveLength(2);
    });
  });

  // ─── hasStrategy ───

  describe('hasStrategy', () => {
    it('should return false for unregistered type', () => {
      expect(registry.hasStrategy('api::course.course')).toBe(false);
    });

    it('should return true for registered type', () => {
      registry.register('api::course.course', vi.fn());
      expect(registry.hasStrategy('api::course.course')).toBe(true);
    });
  });
});
