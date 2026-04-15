import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Upload Guard Middleware', () => {
  let uploadGuard;

  beforeEach(() => {
    vi.resetModules();
    uploadGuard = require('../../../src/middlewares/upload-guard');
  });

  function createCtx(url) {
    return {
      url,
      status: 200,
      body: null,
      cookies: {
        get: vi.fn().mockReturnValue(null)
      },
      request: {
        header: {}
      }
    };

  }

  const mockStrapi = { 
    log: { info: vi.fn(), error: vi.fn() },
    db: { 
      query: vi.fn().mockReturnValue({
        findOne: vi.fn().mockResolvedValue(null) // Default: file not managed by DB
      })
    },
    service: vi.fn().mockReturnValue({
      canAccess: vi.fn().mockResolvedValue(false)
    }),
    plugins: {
      'users-permissions': {
        services: {
          jwt: { verify: vi.fn().mockResolvedValue({ id: 1 }) }
        }
      }
    }
  };

  const next = vi.fn();

  it('should block direct access to /uploads/ path', async () => {
    const ctx = createCtx('/uploads/image_abc123.jpg');
    const middleware = uploadGuard({}, { strapi: mockStrapi });

    await middleware(ctx, next);

    expect(ctx.status).toBe(403);
    expect(ctx.body.error.name).toBe('ForbiddenError');
    expect(next).not.toHaveBeenCalled();
  });

  it('should block nested uploads paths', async () => {
    const ctx = createCtx('/uploads/thumbnails/thumb_abc.jpg');
    const middleware = uploadGuard({}, { strapi: mockStrapi });

    await middleware(ctx, next);

    expect(ctx.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should block video file access', async () => {
    const ctx = createCtx('/uploads/video_lesson1.mp4');
    const middleware = uploadGuard({}, { strapi: mockStrapi });

    await middleware(ctx, next);

    expect(ctx.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow non-upload paths', async () => {
    const ctx = createCtx('/api/courses');
    const middleware = uploadGuard({}, { strapi: mockStrapi });

    await middleware(ctx, next);

    expect(ctx.status).toBe(200);
    expect(next).toHaveBeenCalled();
  });

  it('should allow /api/upload/files path', async () => {
    const ctx = createCtx('/api/upload/files/1');
    const middleware = uploadGuard({}, { strapi: mockStrapi });

    await middleware(ctx, next);

    expect(ctx.status).toBe(200);
    expect(next).toHaveBeenCalled();
  });

  it('should return proper error structure', async () => {
    const ctx = createCtx('/uploads/secret.pdf');
    const middleware = uploadGuard({}, { strapi: mockStrapi });

    await middleware(ctx, next);

    expect(ctx.body).toEqual({
      error: {
        status: 403,
        name: 'ForbiddenError',
        message: 'You do not have permission to access this file directly.',

      },
    });
  });
});
