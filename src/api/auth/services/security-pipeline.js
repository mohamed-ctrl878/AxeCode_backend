'use strict';

/**
 * SecurityPipeline Service
 * High-performance orchestrator for request security.
 */

const rateLimits = new Map(); // Simple in-memory rate limiter

const { z } = require('zod');
const validator = require('validator');

// Basic Sanitization: Escape dangerous HTML/Script characters
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    // skip sanitization for sensitive fields like passwords to avoid corruption
    if (key.toLowerCase().includes('password')) {
      sanitized[key] = value;
      continue;
    }

    if (typeof value === 'string') {
      // Escape HTML, strip tags, and trim
      sanitized[key] = validator.escape(validator.trim(value));
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// Common Schemas
const loginSchema = z.object({
  identifier: z.string().min(3).max(50),
  password: z.string().min(6)
});

const registrationSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, "Username must be alphanumeric"),
  email: z.string().email(),
  password: z.string().min(8),
  firstname: z.string().min(2).max(50),
  lastname: z.string().min(2).max(50)
});

module.exports = ({ strapi }) => ({
  /**
   * Main pipeline entry point
   */
  async run(ctx) {
    // 1. Parallel Stage (Non-dependent checks)
    await Promise.all([
      this.checkRateLimit(ctx),
      this.validateAndSanitize(ctx)
    ]);

    // 2. Sequential Stage (Auth)
    await this.authenticate(ctx);
  },

  /**
   * Simple Fail-Fast Rate Limiter (O(1) lookup)
   */
  async checkRateLimit(ctx) {
    const ip = ctx.ip;
    const path = ctx.request.path || '';
    const now = Date.now();

    // Skip rate limiting for admin panel requests (they make many parallel requests)
    if (path.startsWith('/admin') || path.startsWith('/content-manager')) {
      return;
    }

    const limit = 200; // requests per minute (increased for development)
    const window = 60 * 1000;

    const record = rateLimits.get(ip) || { count: 0, resetTime: now + window };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + window;
    } else {
      record.count++;
    }

    rateLimits.set(ip, record);

    if (record.count > limit) {
      strapi.log.warn(`[Security] Rate limit exceeded for IP: ${ip}`);
      throw ctx.tooManyRequests('Rate limit exceeded. Please try again later.');
    }
  },

  /**
   * Strict Validation & Sanitization
   */
  async validateAndSanitize(ctx) {
    const { method, body, path } = ctx.request;
    if (method === 'GET' || !body) return;

    // 1. Schema Validation (Whitelist Strategy)
    try {
      if (path.includes('/auth/local/register')) {
        registrationSchema.parse(body);
      } else if (path.includes('/auth/local')) {
        loginSchema.parse(body);
      }
      // Add more routes here...
    } catch (err) {
      const issues = err.issues?.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      strapi.log.warn(`[Security] Validation failed for ${path}: ${issues}`);
      throw ctx.badRequest(`Invalid data: ${issues}`);
    }

    // 2. Deep Sanitization (XSS and common injection prevention)
    ctx.request.body = sanitizeObject(body);
  },

  /**
   * Authentication Coordination
   */
  async authenticate(ctx) {
    try {
      const securityLogic = strapi.service('api::auth.security-logic');
      let token = ctx.cookies.get('jwt');
      console.log("[SECURITY DEBUG] Cookie JWT present:", !!token);

      if (!token && ctx.request.header.authorization) {
        const parts = ctx.request.header.authorization.split(' ');
        if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
          token = parts[1];
          console.log("[SECURITY DEBUG] Token extracted from Header");
        }
      }

      if (!token) {
        console.log("[SECURITY DEBUG] No token found in Cookie or Header");
        return;
      }

      const payload = securityLogic.verifyToken(token);
      console.log("[SECURITY DEBUG] Payload verified:", !!payload);

      if (!payload || !payload.id) {
        strapi.log.debug('[Security] Malformed or incompatible JWT payload detected');
        return;
      }

      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: payload.id },
        populate: { role: true }
      });
      console.log("[SECURITY DEBUG] User found in DB:", !!user);

      if (user && !user.blocked) {
        ctx.state.user = user;
        console.log("[SECURITY DEBUG] Auth successful for user ID:", user.id);
      } else if (user?.blocked) {
        console.log("[SECURITY DEBUG] User is blocked");
      }
    } catch (err) {
      strapi.log.error(`[Security] Authentication error: ${err.message}`);
      console.error("[SECURITY DEBUG] Exception:", err);
    }
  }
});
