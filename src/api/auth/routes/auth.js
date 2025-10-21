"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/auth/login",
      handler: "auth.login",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/auth/logout",
      handler: "auth.logout",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/auth/me",
      handler: "auth.me",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/auth/refresh",
      handler: "auth.refresh",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/auth/check-permission",
      handler: "auth.checkPermission",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/auth/check-role",
      handler: "auth.checkRole",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/auth/forgot-password",
      handler: "auth.forgotPassword",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/auth/reset-password",
      handler: "auth.resetPassword",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/auth/register",
      handler: "auth.register",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/auth/confirm-email",
      handler: "auth.confirmEmail",
      config: {
        auth: false,
      },
    },
  ],
};
