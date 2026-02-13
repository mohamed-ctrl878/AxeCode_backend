import { describe, it, expect, vi } from 'vitest';
const StrapiMock = require('../../helpers/strapi-mock');
const strapiMock = new StrapiMock();

const pipelineFactory = require('../../../src/api/auth/services/security-pipeline');
const pipeline = pipelineFactory({ strapi: strapiMock });

describe('SecurityPipeline Service', () => {
  describe('checkRateLimit', () => {
    it('should allow requests within limit', async () => {
      const ctx = strapiMock.mockContext({ ip: '1.2.3.4' });
      await expect(pipeline.checkRateLimit(ctx)).resolves.not.toThrow();
    });

    it('should throw tooManyRequests when limit exceeded', async () => {
      const ctx = strapiMock.mockContext({ ip: '9.9.9.9' });
      // Simulate 101 requests
      for (let i = 0; i < 100; i++) {
        await pipeline.checkRateLimit(ctx);
      }
      await expect(pipeline.checkRateLimit(ctx)).rejects.toThrow();
    });
  });

  describe('validateAndSanitize', () => {
    it('should validate login payload correctly', async () => {
      const ctx = strapiMock.mockContext({
        method: 'POST',
        path: '/api/auth/local',
        body: { identifier: 'user@test.com', password: 'password123' }
      });
      await expect(pipeline.validateAndSanitize(ctx)).resolves.not.toThrow();
    });

    it('should throw badRequest for invalid email in registration', async () => {
      const ctx = strapiMock.mockContext({
        method: 'POST',
        path: '/api/auth/local/register',
        body: { username: 'user', email: 'invalid-email', password: '123' }
      });
      await expect(pipeline.validateAndSanitize(ctx)).rejects.toThrow();
    });

    it('should sanitize dangerous HTML tags from body', async () => {
      const ctx = strapiMock.mockContext({
        method: 'POST',
        body: { comment: '<script>alert(1)</script> Hello' }
      });
      await pipeline.validateAndSanitize(ctx);
      
      // Validator.escape converts < to &lt; etc.
      expect(ctx.request.body.comment).not.toContain('<script>');
      expect(ctx.request.body.comment).toContain('&lt;script&gt;');
    });
    it('should sanitize nested objects and arrays', async () => {
      const ctx = strapiMock.mockContext({
        method: 'POST',
        body: { 
          tags: ['<b>bold</b>'], 
          meta: { description: '<i>italic</i>' },
          price: 100 
        }
      });
      await pipeline.validateAndSanitize(ctx);
      
      // validator.escape escapes / to &#x2F;
      expect(ctx.request.body.tags[0]).toBe('&lt;b&gt;bold&lt;&#x2F;b&gt;');
      expect(ctx.request.body.meta.description).toBe('&lt;i&gt;italic&lt;&#x2F;i&gt;');
      expect(ctx.request.body.price).toBe(100);
    });

    it('should ignore GET requests without body', async () => {
        const ctx = strapiMock.mockContext({ method: 'GET', body: null });
        await expect(pipeline.validateAndSanitize(ctx)).resolves.not.toThrow();
    });
  });

  describe('authenticate', () => {
    it('should bypass if no jwt cookie is present', async () => {
        const ctx = strapiMock.mockContext({});
        ctx.cookies.get = vi.fn().mockReturnValue(null);
        await pipeline.authenticate(ctx);
        expect(ctx.state.user).toBeUndefined();
    });

    it('should populate ctx.state.user for a valid token', async () => {
        const ctx = strapiMock.mockContext({});
        ctx.cookies.get = vi.fn().mockReturnValue('valid-token');
        
        vi.spyOn(strapiMock, 'service').mockReturnValue({
            verifyToken: () => ({ id: 1 })
        });
        
        // Mock db.query directly
        const mockQuery = { findOne: async () => ({ id: 1, username: 'testuser', role: { type: 'admin' } }) };
        vi.spyOn(strapiMock.db, 'query').mockReturnValue(mockQuery);

        await pipeline.authenticate(ctx);
        expect(ctx.state.user.username).toBe('testuser');
    });

    it('should not populate user if verifyToken fails', async () => {
        const ctx = strapiMock.mockContext({});
        ctx.cookies.get = vi.fn().mockReturnValue('bad-token');
        
        vi.spyOn(strapiMock, 'service').mockReturnValue({
            verifyToken: () => null
        });

        await pipeline.authenticate(ctx);
        expect(ctx.state.user).toBeUndefined();
    });
  });
});
