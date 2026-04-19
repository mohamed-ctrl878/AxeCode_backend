import { describe, it, expect, vi, beforeEach } from 'vitest';
import authServiceModule from '../../../src/api/auth/services/onboarding-facade.js';

// Mock the dependencies
vi.mock('@strapi/strapi', () => ({
  default: () => ({
    db: { query: vi.fn() },
    plugin: vi.fn().mockReturnThis(),
    service: vi.fn()
  })
}));

/**
 * ═══════════════════════════════════════════════════════════════
 * 🛡️ API SECURITY SCANS (FUZZING & DAST)
 * ═══════════════════════════════════════════════════════════════
 * This suite aggressively attacks AxeCode's input vectors 
 * with malicious payloads to ensure the app doesn't crash 
 * and properly sanitizes bad data (SQLi, NoSQLi, XSS).
 * ═══════════════════════════════════════════════════════════════
 */

describe('Security & Fuzzing (Anti-Crash & Input Sanitization)', () => {
  
  const authFacade = authServiceModule({ strapi: global.strapi });

  // Common malicious payloads
  const PAYLOADS = {
    sqlInjection: "' OR 1=1 --",
    noSqlInjection: { "$gt": "" },
    xssBasic: "<script>alert('xss')</script>",
    xssAdvanced: "javascript:/*--></title></style></textarea></script></xmp><svg/onload='+-\"*/alert(1)'>",
    hugeString: "A".repeat(100000), // Buffer overflow / DoS
    deepJson: JSON.parse('{"a":'.repeat(500) + '1' + '}'.repeat(500)), // Prototype pollution / stack overflow
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('User Onboarding Input Fuzzing (Login & Registration)', () => {
    
    it('rejects SQL Injection attempts in email field gracefully', async () => {
      // Create a mock context for Koa
      const ctx = {
        request: {
          body: {
            email: PAYLOADS.sqlInjection,
            password: 'ValidPassword123!',
          }
        },
        throw: vi.fn(),
      };

      try {
        // If the facade throws normally (e.g. invalid email length/format) it's safe.
        // If it crashes Node.js, we have a huge problem!
        await authFacade.fullRegistration(ctx, ctx.request.body);
      } catch (err) {
        expect(err).toBeDefined(); // Must throw an error
        // Ensure no raw SQL error strings leak to the user
        expect(err.message.toLowerCase()).not.toContain('syntax error at or near');
      }
      
      // Specifically testing the Koa strict context throw
      expect(ctx.throw).toHaveBeenCalled();
    });

    it('survives Massive Payload Attacks (Denial of Service resistance)', async () => {
      const ctx = {
        request: {
          body: {
            email: 'test@example.com',
            password: PAYLOADS.hugeString, // 100,000 characters
          }
        },
        throw: vi.fn((status, msg) => { throw new Error(msg); }),
      };

      // Depending on our validation, it should reject huge passwords immediately BEFORE hashing.
      // If it passes this to bcrypt, Node's event loop will block for minutes (DoS vulnerability).
      let threwError = false;
      try {
        await authFacade.fullRegistration(ctx, ctx.request.body);
      } catch (e) {
        threwError = true;
      }
      
      expect(threwError).toBe(true);
      expect(ctx.throw).toHaveBeenCalledWith(400, expect.any(String));
    });

    it('handles unexpected structural payloads without crashing (Prototype Pollution/Deep JSON)', async () => {
       const ctx = {
        request: {
          body: {
            email: PAYLOADS.deepJson, 
            password: 'pwd'
          }
        },
        throw: vi.fn((status, msg) => { throw new Error(msg); }),
      };

      let threwError = false;
      try {
        await authFacade.fullRegistration(ctx, ctx.request.body);
      } catch (e) {
        threwError = true;
      }
      
      // It should safely throw a 400 Bad Request, not crash the process.
      expect(threwError).toBe(true);
      expect(ctx.throw).toHaveBeenCalledWith(400, expect.any(String));
    });
  });

});
