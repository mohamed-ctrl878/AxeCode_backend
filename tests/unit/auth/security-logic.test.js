import { describe, it, expect, vi } from 'vitest';
const StrapiMock = require('../../helpers/strapi-mock');
const strapiMock = new StrapiMock();

const logicFactory = require('../../../src/api/auth/services/security-logic');
const securityLogic = logicFactory({ strapi: strapiMock });

describe('SecurityLogic Service', () => {
  describe('setAuthCookie', () => {
    it('should set Set-Cookie header with correct options', () => {
      const mockSet = vi.fn();
      const ctx = { 
        set: mockSet, 
        response: { get: vi.fn().mockReturnValue([]) },
        log: strapiMock.log 
      };
      
      securityLogic.setAuthCookie(ctx, 'fake-jwt');
      
      expect(mockSet).toHaveBeenCalledWith('Set-Cookie', expect.arrayContaining([
        expect.stringContaining('jwt=fake-jwt'),
        expect.stringContaining('HttpOnly'),
        expect.stringContaining('Path=/')
      ]));
    });

    it('should include domain in cookie if COOKIE_DOMAIN is set', () => {
      process.env.COOKIE_DOMAIN = 'example.com';
      // Re-initialize logic to pick up env change if needed, 
      // though the service currently captures it at factory level.
      // For the test, we might need a fresh instance if it doesn't pick up process.env dynamically.
      const freshLogic = logicFactory({ strapi: strapiMock });
      
      const mockSet = vi.fn();
      const ctx = { 
        set: mockSet, 
        response: { get: vi.fn().mockReturnValue([]) },
        log: strapiMock.log 
      };
      
      freshLogic.setAuthCookie(ctx, 'fake-jwt');
      
      expect(mockSet).toHaveBeenCalledWith('Set-Cookie', expect.arrayContaining([
        expect.stringContaining('Domain=example.com')
      ]));
      delete process.env.COOKIE_DOMAIN;
    });
  });

  describe('clearAuthCookie', () => {
    it('should set maxAge to 0 to clear cookie', () => {
        const mockSet = vi.fn();
        const ctx = { 
          set: mockSet, 
          response: { get: vi.fn().mockReturnValue([]) },
          log: strapiMock.log 
        };
        
        securityLogic.clearAuthCookie(ctx);
        
        expect(mockSet).toHaveBeenCalledWith('Set-Cookie', expect.arrayContaining([
          expect.stringContaining('jwt=;'),
          expect.stringContaining('Max-Age=0')
        ]));
    });
  });

  describe('issueToken / verifyToken', () => {
    it('should return a valid token using users-permissions service', () => {
      const token = securityLogic.issueToken({ id: 1 });
      expect(token).toBe('mock-token');
    });

    it('should verify and return payload for valid token', async () => {
        const payload = await securityLogic.verifyToken('valid-token');
        expect(payload.id).toBe(1);
    });

    it('should return null for invalid token', async () => {
        // Force wrap verify to throw
        vi.spyOn(strapiMock.plugins['users-permissions'].services.jwt, 'verify').mockImplementationOnce(() => {
            throw new Error();
        });
        const payload = await securityLogic.verifyToken('bad-token');
        expect(payload).toBeNull();
    });
  });
});
