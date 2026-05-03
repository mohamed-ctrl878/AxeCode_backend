'use strict';

/**
 * Policy: is-publisher
 * Ensures the authenticated user has the 'publisher' role.
 */
module.exports = async (ctx, config, { strapi }) => {
  const user = ctx.state.user;
  if (!user) {
    return ctx.unauthorized('Authentication required');
  }

  // Populate role if not already populated
  let role = user.role;
  if (!role || !role.type) {
    const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: user.id },
      populate: { role: true },
    });
    role = fullUser?.role;
  }

  if (!role || role.type !== 'publisher') {
    return ctx.forbidden('Publisher access required');
  }

  return true;
};
