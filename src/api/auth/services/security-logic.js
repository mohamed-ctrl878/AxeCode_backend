'use strict';

/**
 * SecurityLogic Service
 * Centralizes authentication security, cookie management, and JWT handling.
 */

module.exports = ({ strapi }) => ({
  /**
   * Set HTTP-only cookie for JWT
   */
  setAuthCookie(ctx, jwt) {
    const isProd = process.env.NODE_ENV === 'production';

    ctx.cookies.set('jwt', jwt, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax', // تم التغيير من strict لضمان عملها بين المنافذ المختلفة في التطوير
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined,
    });

    strapi.log.debug(`[Security] Auth cookie set for user`);
  },

  /**
   * Clear authentication cookie
   */
  clearAuthCookie(ctx) {
    ctx.cookies.set('jwt', null, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined,
    });

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
  verifyToken(token) {
    try {
      return strapi.plugins['users-permissions'].services.jwt.verify(token);
    } catch (err) {
      return null;
    }
  }
});
