"use strict";

/**
 * product controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::product.product", ({ strapi }) => ({
  async testAuth(ctx) {
    // التحقق من المصادقة باستخدام middleware الجديد
    if (!ctx.state.user) {
      return ctx.unauthorized("Not authenticated. Please login first.");
    }

    // هذا سيكون متاحاً فقط إذا كان المستخدم مصادق عليه
    return {
      message: "Authentication successful!",
      user: {
        id: ctx.state.user.id,
        username: ctx.state.user.username,
        email: ctx.state.user.email,
        role: ctx.state.user.role?.type,
      },
      timestamp: new Date().toISOString(),
    };
  },

  async getProtectedData(ctx) {
    // التحقق من المصادقة
    if (!ctx.state.user) {
      return ctx.unauthorized("Not authenticated. Please login first.");
    }

    // مثال على endpoint للبيانات المحمية
    return {
      message: "This is protected data",
      user: ctx.state.user.username,
      data: {
        courses: await strapi.entityService.findMany("api::course.course", {
          populate: ["lessons"],
        }),
      },
    };
  },

  // مثال على endpoint يتطلب صلاحية محددة
  async createProduct(ctx) {
    // التحقق من الصلاحية
    const authService = strapi.service("api::auth.auth-service");
    const canCreate = await authService.checkPermission(
      ctx,
      "create",
      "api::product.product"
    );

    if (!canCreate) {
      return ctx.forbidden("Insufficient permissions to create products");
    }

    // إنشاء المنتج
    const data = ctx.request.body;
    const product = await strapi.entityService.create("api::product.product", {
      data: data,
    });

    return ctx.send({
      message: "Product created successfully",
      product: product,
    });
  },

  // مثال على endpoint يتطلب دور محدد
  async adminOnly(ctx) {
    // التحقق من الدور
    const authService = strapi.service("api::auth.auth-service");
    const isAdmin = await authService.hasRole(ctx, "admin");

    if (!isAdmin) {
      return ctx.forbidden("Admin role required");
    }

    return ctx.send({
      message: "Admin access granted",
      user: ctx.state.user.username,
    });
  },

  // مثال على endpoint مع صلاحيات متعددة
  async updateProduct(ctx) {
    const { id } = ctx.params;
    const data = ctx.request.body;

    // التحقق من الصلاحية للتحديث
    const authService = strapi.service("api::auth.auth-service");
    const canUpdate = await authService.checkPermission(
      ctx,
      "update",
      "api::product.product"
    );

    if (!canUpdate) {
      return ctx.forbidden("Insufficient permissions to update products");
    }

    // التحقق من ملكية المنتج (إذا كان مطلوباً)
    const product = await strapi.entityService.findOne(
      "api::product.product",
      id
    );
    if (product && product.createdBy !== ctx.state.user.id) {
      // التحقق من صلاحية التحديث على منتجات الآخرين
      const canUpdateOthers = await authService.checkPermission(
        ctx,
        "update",
        "api::product.product"
      );
      if (!canUpdateOthers) {
        return ctx.forbidden("Cannot update products created by others");
      }
    }

    // تحديث المنتج
    const updatedProduct = await strapi.entityService.update(
      "api::product.product",
      id,
      {
        data: data,
      }
    );

    return ctx.send({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  },
}));
