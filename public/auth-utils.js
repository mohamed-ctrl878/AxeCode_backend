/**
 * HttpOnly Cookies Authentication Utility
 * للتعامل مع المصادقة باستخدام HttpOnly cookies
 */

class HttpOnlyAuth {
  constructor(baseUrl = "http://localhost:1338") {
    this.baseUrl = baseUrl;
  }

  // تسجيل الدخول
  async login(identifier, password) {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identifier, password }),
        credentials: "include", // مهم للـ HttpOnly cookies
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Login failed");
      }

      return data;
    } catch (error) {
      throw new Error(`Login error: ${error.message}`);
    }
  }

  // تسجيل الخروج
  async logout() {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include", // مهم للـ HttpOnly cookies
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Logout failed");
      }

      return data;
    } catch (error) {
      throw new Error(`Logout error: ${error.message}`);
    }
  }

  // الحصول على المستخدم الحالي
  async getCurrentUser() {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/me`, {
        credentials: "include", // مهم للـ HttpOnly cookies
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to get current user");
      }

      return data.user;
    } catch (error) {
      throw new Error(`Get current user error: ${error.message}`);
    }
  }

  // تحديث الـ token
  async refreshToken() {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: "POST",
        credentials: "include", // مهم للـ HttpOnly cookies
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Token refresh failed");
      }

      return data;
    } catch (error) {
      throw new Error(`Token refresh error: ${error.message}`);
    }
  }

  // التحقق من الصلاحية
  async checkPermission(action, subject) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/auth/check-permission`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action, subject }),
          credentials: "include", // مهم للـ HttpOnly cookies
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Permission check failed");
      }

      return data.hasPermission;
    } catch (error) {
      throw new Error(`Permission check error: ${error.message}`);
    }
  }

  // التحقق من الدور
  async checkRole(roleName) {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/check-role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roleName }),
        credentials: "include", // مهم للـ HttpOnly cookies
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Role check failed");
      }

      return data.hasRole;
    } catch (error) {
      throw new Error(`Role check error: ${error.message}`);
    }
  }

  // طلب محمي (مع التحقق التلقائي من المصادقة)
  async authenticatedRequest(url, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}${url}`, {
        ...options,
        credentials: "include", // مهم للـ HttpOnly cookies
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // محاولة تحديث الـ token
          try {
            await this.refreshToken();
            // إعادة المحاولة
            return this.authenticatedRequest(url, options);
          } catch (refreshError) {
            throw new Error("Authentication expired. Please login again.");
          }
        }
        throw new Error(data.error?.message || "Request failed");
      }

      return data;
    } catch (error) {
      throw new Error(`Authenticated request error: ${error.message}`);
    }
  }

  // التحقق من حالة المصادقة
  async isAuthenticated() {
    try {
      await this.getCurrentUser();
      return true;
    } catch (error) {
      return false;
    }
  }

  // الحصول على معلومات المستخدم مع التخزين المؤقت
  async getUserInfo() {
    if (!this._userInfo) {
      this._userInfo = await this.getCurrentUser();
    }
    return this._userInfo;
  }

  // مسح التخزين المؤقت
  clearCache() {
    this._userInfo = null;
  }
}

// تصدير الكلاس للاستخدام العام
if (typeof module !== "undefined" && module.exports) {
  module.exports = HttpOnlyAuth;
} else if (typeof window !== "undefined") {
  window.HttpOnlyAuth = HttpOnlyAuth;
}
