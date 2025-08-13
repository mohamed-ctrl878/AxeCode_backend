"use strict";

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    try {
      // التحقق من وجود JWT في cookies
      const token = ctx.cookies.get("jwt");

      if (token) {
        try {
          // التحقق من صحة الـ token
          const payload =
            strapi.plugins["users-permissions"].services.jwt.verify(token);

          // البحث عن المستخدم
          const user = await strapi.plugins[
            "users-permissions"
          ].services.user.fetch({
            id: payload.id,
          });

          if (user && !user.blocked) {
            // إضافة المستخدم إلى context
            ctx.state.user = user;
            ctx.state.userAbility =
              await strapi.plugins["users-permissions"].services.user.ability(
                user
              );
          }
        } catch (error) {
          // إذا كان الـ token غير صالح، احذفه
          ctx.cookies.set("jwt", null, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 0,
            path: "/",
          });
        }
      }

      await next();
    } catch (error) {
      await next();
    }
  };
};
