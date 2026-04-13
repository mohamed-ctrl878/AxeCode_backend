'use strict';

/**
 * SecurityLogic Service
 * Centralizes authentication security, cookie management, and JWT handling.
 */

module.exports = ({ strapi }) => {
  const isProd = process.env.NODE_ENV === 'production';
  const domain = process.env.COOKIE_DOMAIN === 'localhost' ? undefined : process.env.COOKIE_DOMAIN;

  return {
    /**
     * Set HTTP-only cookie for JWT
     */
    setAuthCookie(ctx, jwt) {
      ctx.cookies.set('jwt', jwt, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax', // 'none' required for cross-domain Vercel -> Strapi Cloud
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/',
        domain: domain || undefined,
      });

      strapi.log.debug(`[Security] Auth cookie set for user`);
    },

  /**
   * Clear authentication cookie
   */
  clearAuthCookie(ctx) {
    ctx.cookies.set('jwt', null, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 0,
      path: '/',
      domain: domain || undefined,
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
  async verifyToken(token) {
    try {
      return await strapi.plugins['users-permissions'].services.jwt.verify(token);
    } catch (err) {
      return null;
    }
  };
};
