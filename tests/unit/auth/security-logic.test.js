import { describe, it, expect, vi } from 'vitest';
const StrapiMock = require('../../helpers/strapi-mock');
const strapiMock = new StrapiMock();

const logicFactory = require('../../../src/api/auth/services/security-logic');
const securityLogic = logicFactory({ strapi: strapiMock });

describe('SecurityLogic Service', () => {
  describe('setAuthCookie', () => {
    it('should call ctx.cookies.set with correct options', () => {
      const mockSet = vi.fn();
      const ctx = { cookies: { set: mockSet }, log: strapiMock.log };
      
      securityLogic.setAuthCookie(ctx, 'fake-jwt');
      
      expect(mockSet).toHaveBeenCalledWith('jwt', 'fake-jwt', expect.objectContaining({
        httpOnly: true,
        path: '/'
      }));
    });
    it('should include domain in cookie options if COOKIE_DOMAIN is set', () => {
      process.env.COOKIE_DOMAIN = 'example.com';
      const mockSet = vi.fn();
      const ctx = { cookies: { set: mockSet }, log: strapiMock.log };
      
      securityLogic.setAuthCookie(ctx, 'fake-jwt');
      
      expect(mockSet).toHaveBeenCalledWith('jwt', 'fake-jwt', expect.objectContaining({
        domain: 'example.com'
      }));
      delete process.env.COOKIE_DOMAIN;
    });
  });

  describe('clearAuthCookie', () => {
    it('should set maxAge to 0 to clear cookie', () => {
        const mockSet = vi.fn();
        const ctx = { cookies: { set: mockSet }, log: strapiMock.log };
        
        securityLogic.clearAuthCookie(ctx);
        
        expect(mockSet).toHaveBeenCalledWith('jwt', null, expect.objectContaining({
          maxAge: 0
        }));
    });
  });

  describe('issueToken / verifyToken', () => {
    it('should return a valid token using users-permissions service', () => {
      const token = securityLogic.issueToken({ id: 1 });
      expect(token).toBe('mock-token');
    });

    it('should verify and return payload for valid token', () => {
        const payload = securityLogic.verifyToken('valid-token');
        expect(payload.id).toBe(1);
    });

    it('should return null for invalid token', () => {
        // Force wrap verify to throw
        vi.spyOn(strapiMock.plugins['users-permissions'].services.jwt, 'verify').mockImplementationOnce(() => {
            throw new Error();
        });
        const payload = securityLogic.verifyToken('bad-token');
        expect(payload).toBeNull();
    });
  });
});
