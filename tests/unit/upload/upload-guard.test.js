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
    };
  }

  const mockStrapi = { log: { info: vi.fn() } };
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
        message: 'Direct file access is not allowed. Use /api/upload/files/:id instead.',
      },
    });
  });
});
