'use strict';

/**
 * MessengerAuth Service
 * Handles socket authentication and user attachment.
 */

module.exports = ({ strapi }) => ({
  /**
   * Parse cookies from header string
   */
  parseCookies(cookieString) {
    if (!cookieString) return {};
    return cookieString.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = decodeURIComponent(value);
      return acc;
    }, {});
  },

  /**
   * Middleware for socket authentication
   */
  async authenticate(socket, next) {
    try {
      let token = socket.handshake.auth && socket.handshake.auth.token;

      // Fallback to cookies if no token in auth
      if (!token && socket.handshake.headers.cookie) {
        const cookies = this.parseCookies(socket.handshake.headers.cookie);
        token = cookies['jwt'];
      }

      if (!token) {
        strapi.log.warn('[MessengerAuth] No token found in auth or cookies');
        return next(new Error('Not authenticated'));
      }

      const jwtService = strapi.plugins['users-permissions'].services.jwt;
      const payload = await jwtService.verify(token);
      
      const userId = payload.id;
      if (!userId) {
        strapi.log.error('[MessengerAuth] JWT payload missing user ID');
        return next(new Error('Invalid token'));
      }

      // Fetch user with essential details
      let user;
      try {
        user = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { id: userId },
          populate: { role: true, avatar: true }
        });
      } catch (dbErr) {
        strapi.log.error(`[MessengerAuth] Database error fetching user: ${dbErr.message}`);
        return next(new Error('Authentication service temporarily unavailable'));
      }

      if (!user || user.blocked) {
        return next(new Error('User inaccessible or blocked'));
      }

      // Attach cleaned user object to socket
      socket.user = {
        id: user.id,
        documentId: user.documentId,
        username: user.username,
        role: user.role?.type || null,
        avatar: user.avatar?.url || null,
      };

      strapi.log.info(`[MessengerAuth] Authenticated: ${socket.user.username}`);
      return next();
    } catch (error) {
      strapi.log.error('[MessengerAuth] Auth error:', error.message);
      return next(new Error('Authentication failed'));
    }
  }
});
