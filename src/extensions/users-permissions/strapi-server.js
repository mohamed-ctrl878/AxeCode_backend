'use strict';

module.exports = (plugin) => {
  strapi.log.info('>>> Loading users-permissions extension...');

  // Inspect and modify routes
  if (plugin.routes['content-api']) {
      plugin.routes['content-api'].routes.forEach(route => {
          if (route.path === '/auth/local/register' && route.method === 'POST') {
              strapi.log.info('>>> Found register route. Redirecting to custom controller...');
              
              route.handler = 'api::auth.auth.register';
              
              route.config = {
                  ...route.config,
                  auth: false,
                  prefix: '',
              };
              
              strapi.log.info('>>> Register route redirected to api::auth.auth.register');
          }
      });
  }

  // Override the 'me' controller to support dynamic populate including scanners
  plugin.controllers.user.me = async (ctx) => {
    const user = ctx.state.user;
    
    if (!user) {
      return ctx.unauthorized('No authorization header was found');
    }

    // Build populate from query or use default
    let populate = ctx.query.populate;
    
    // If populate=* or user wants all, expand to include scanners and created conversations
    if (populate === '*') {
      populate = {
        role: true,
        avatar: true,
        scanners: { populate: { event: true } },
        created_conversations: true,
        user_entitlements: true,
        courses: true,
        events: true,
        conversations: true,
        messages: true,
        posts: true,
        likes: true,
        comments: true,
        lessons: true,
        weeks: true
      };
    } else if (!populate) {
      // Default minimal populate
      populate = { role: true, avatar: true, created_conversations: true, conversations: true };
    }

    // Fetch user with requested relations
    const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: user.id },
      populate: populate
    });

    if (!fullUser) {
      return ctx.notFound('User not found');
    }

    // Remove sensitive fields
    delete fullUser.password;
    delete fullUser.resetPasswordToken;
    delete fullUser.confirmationToken;

    ctx.body = fullUser;
  };

  return plugin;
};