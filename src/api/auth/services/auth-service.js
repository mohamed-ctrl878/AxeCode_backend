"use strict";

module.exports = ({ strapi }) => ({
  // تسجيل الدخول مع HttpOnly cookies
  async login(ctx, identifier, password) {
    try {
      // التحقق من بيانات المستخدم
      const user = await strapi.plugins[
        "users-permissions"
      ].services.user.validatePassword(password, identifier);

      if (!user) {
        throw new Error("Invalid credentials");
      }

      if (user.blocked) {
        throw new Error("User is blocked");
      }

      if (!user.confirmed) {
        throw new Error("User is not confirmed");
      }

      // إنشاء JWT token
      const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
        id: user.id,
      });

      // تعيين HttpOnly cookie
      ctx.cookies.set("jwt", jwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 يوم
        path: "/",
        domain: process.env.COOKIE_DOMAIN || undefined,
      });

      // إضافة المستخدم إلى context
      ctx.state.user = user;
      ctx.state.userAbility =
        await strapi.plugins["users-permissions"].services.user.ability(user);

      return {
        jwt,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          confirmed: user.confirmed,
          blocked: user.blocked,
        },
      };
    } catch (error) {
      throw error;
    }
  },

  // تسجيل الخروج
  async logout(ctx) {
    // حذف HttpOnly cookie
    ctx.cookies.set("jwt", null, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
      path: "/",
      domain: process.env.COOKIE_DOMAIN || undefined,
    });

    return { message: "Logged out successfully" };
  },

  // الحصول على المستخدم الحالي
  async getCurrentUser(ctx) {
    const token = ctx.cookies.get("jwt");

    if (!token) {
      return null;
    }

    try {
      const payload =
        strapi.plugins["users-permissions"].services.jwt.verify(token);
      const user = await strapi.plugins[
        "users-permissions"
      ].services.user.fetch({
        id: payload.id,
      });

      if (user && !user.blocked) {
        return {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          confirmed: user.confirmed,
          blocked: user.blocked,
        };
      }
    } catch (error) {
      return null;
    }

    return null;
  },

  // تحديث الـ token
  async refreshToken(ctx) {
    const token = ctx.cookies.get("jwt");

    if (!token) {
      throw new Error("No token found");
    }

    try {
      const payload =
        strapi.plugins["users-permissions"].services.jwt.verify(token);
      const user = await strapi.plugins[
        "users-permissions"
      ].services.user.fetch({
        id: payload.id,
      });

      if (!user || user.blocked) {
        throw new Error("Invalid user");
      }

      // إنشاء token جديد
      const newJwt = strapi.plugins["users-permissions"].services.jwt.issue({
        id: user.id,
      });

      // تحديث HttpOnly cookie
      ctx.cookies.set("jwt", newJwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 يوم
        path: "/",
        domain: process.env.COOKIE_DOMAIN || undefined,
      });

      return {
        jwt: newJwt,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      throw error;
    }
  },

  // التحقق من الصلاحيات
  async checkPermission(ctx, action, subject) {
    const user = ctx.state.user;

    if (!user) {
      return false;
    }

    try {
      const ability =
        await strapi.plugins["users-permissions"].services.user.ability(user);
      return ability.can(action, subject);
    } catch (error) {
      return false;
    }
  },

  // التحقق من الدور
  async hasRole(ctx, roleName) {
    const user = ctx.state.user;

    if (!user || !user.role) {
      return false;
    }

    return user.role.type === roleName;
  },
});
