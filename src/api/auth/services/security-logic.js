'use strict';

/**
 * SecurityLogic Service
 * Centralizes authentication security, cookie management, and JWT handling.
 */

module.exports = ({ strapi }) => {
  const isProd = process.env.NODE_ENV === 'production';
  const domain = process.env.COOKIE_DOMAIN === 'localhost' ? undefined : process.env.COOKIE_DOMAIN;

  /**
   * Build a Set-Cookie header string manually.
   * This bypasses Koa's ctx.cookies.set() which throws
   * "Cannot send secure cookie over unencrypted connection"
   * when running behind a TLS-terminating reverse proxy (Cloudflare Tunnel).
   */
  function buildCookieHeader(name, value, options = {}) {
    let cookie = `${name}=${value || ''}`;
    if (options.maxAge != null) cookie += `; Max-Age=${Math.floor(options.maxAge / 1000)}`;
    if (options.path) cookie += `; Path=${options.path}`;
    if (options.domain) cookie += `; Domain=${options.domain}`;
    if (options.httpOnly) cookie += '; HttpOnly';
    if (options.secure) cookie += '; Secure';
    if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
    return cookie;
  }

  return {
    /**
     * Set HTTP-only cookie for JWT
     */
    setAuthCookie(ctx, jwt) {
      const cookieStr = buildCookieHeader('jwt', jwt, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'None' : 'Lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/',
        domain: domain || undefined,
      });

      // Append to existing Set-Cookie headers (don't overwrite)
      const existing = ctx.response?.get ? ctx.response.get('Set-Cookie') : [];

      const headers = Array.isArray(existing) ? existing : (existing ? [existing] : []);
      headers.push(cookieStr);
      if (ctx.set) ctx.set('Set-Cookie', headers);


      strapi.log.debug(`[Security] Auth cookie set for user`);
    },

    /**
     * Clear authentication cookie
     */
    clearAuthCookie(ctx) {
      const cookieStr = buildCookieHeader('jwt', '', {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'None' : 'Lax',
        maxAge: 0,
        path: '/',
        domain: domain || undefined,
      });

      const existing = ctx.response?.get ? ctx.response.get('Set-Cookie') : [];

      const headers = Array.isArray(existing) ? existing : (existing ? [existing] : []);
      headers.push(cookieStr);
      if (ctx.set) ctx.set('Set-Cookie', headers);


      strapi.log.debug(`[Security] Auth cookie cleared`);
    },

    /**
     * Issue a new JWT token for a user
     */
    issueToken(user) {
      return strapi.plugins['users-permissions'].services.jwt.issue({
        id: user.id,
      });
    },

    /**
     * Verify a JWT token from cookie
     */
    async verifyToken(token) {
      try {
        return await strapi.plugins['users-permissions'].services.jwt.verify(token);
      } catch (err) {
        strapi.log.debug(`[Security] Token verification failed: ${err.message}`);
        return null;
      }
    }

  };
};
