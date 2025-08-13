# 🚀 دليل تنفيذ HttpOnly Cookies Authentication

## 📋 نظرة عامة

هذا الدليل يشرح كيفية تنفيذ نظام مصادقة آمن باستخدام HttpOnly cookies في Strapi، بدلاً من الـ tokens التقليدية المخزنة في localStorage أو sessionStorage.

## 🎯 المميزات

- ✅ **حماية من XSS**: لا يمكن الوصول إلى الـ cookies من JavaScript
- ✅ **حماية من CSRF**: استخدام SameSite cookies
- ✅ **تحديث تلقائي للـ tokens**: تجديد الـ tokens عند انتهاء صلاحيتها
- ✅ **إدارة مركزية**: جميع عمليات المصادقة تتم من جانب الخادم
- ✅ **صلاحيات متقدمة**: نظام صلاحيات وأدوار شامل
- ✅ **اختبارات شاملة**: أدوات اختبار مدمجة

## 🛠️ المتطلبات

- Strapi v4.x
- Node.js v18+
- قاعدة بيانات (SQLite/PostgreSQL/MySQL)

## 📦 التثبيت

### 1. إعداد المتغيرات البيئية

أنشئ ملف `.env` في مجلد المشروع:

```env
# Database
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db

# JWT Secrets
JWT_SECRET=your-super-secret-jwt-key-here
ADMIN_JWT_SECRET=your-super-secret-admin-jwt-key-here
API_TOKEN_SALT=your-api-token-salt-here
TRANSFER_TOKEN_SALT=your-transfer-token-salt-here

# App Keys
APP_KEYS=key1,key2,key3,key4

# Cookie Domain (for production)
COOKIE_DOMAIN=your-domain.com

# Email Configuration
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password

# Environment
NODE_ENV=development

# Server Configuration
HOST=0.0.0.0
PORT=1337
```

### 2. تشغيل المشروع

```bash
# تثبيت التبعيات
npm install

# تشغيل المشروع
npm run dev
```

## 🔧 التكوين

### 1. إعدادات Middleware

تم تحديث `config/middlewares.js` ليشمل:

```javascript
{
  name: "strapi::jwt",
  config: {
    httpOnly: true,        // يمنع الوصول من JavaScript
    secure: process.env.NODE_ENV === 'production', // HTTPS فقط في الإنتاج
    sameSite: "strict",    // حماية من CSRF
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 يوم
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined
  }
}
```

### 2. إعدادات Users-Permissions

تم تحديث `config/plugins.js` ليشمل:

```javascript
"users-permissions": {
  config: {
    register: {
      emailConfirmation: true,
    },
    jwt: {
      expiresIn: '30d',
    },
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined
    }
  },
}
```

## 📡 API Endpoints

### المصادقة

#### تسجيل الدخول

```http
POST /api/auth/login
Content-Type: application/json

{
  "identifier": "user@example.com",
  "password": "password123"
}
```

#### تسجيل الخروج

```http
POST /api/auth/logout
```

#### الحصول على المستخدم الحالي

```http
GET /api/auth/me
```

#### تحديث الـ Token

```http
POST /api/auth/refresh
```

### الصلاحيات والأدوار

#### فحص الصلاحية

```http
POST /api/auth/check-permission
Content-Type: application/json

{
  "action": "create",
  "subject": "api::product.product"
}
```

#### فحص الدور

```http
POST /api/auth/check-role
Content-Type: application/json

{
  "roleName": "admin"
}
```

### البيانات المحمية

#### اختبار المصادقة

```http
GET /api/products/test-auth
```

#### البيانات المحمية

```http
GET /api/products/protected-data
```

#### إنشاء منتج (يتطلب صلاحية)

```http
POST /api/products/create-product
Content-Type: application/json

{
  "name": "منتج جديد",
  "description": "وصف المنتج",
  "price": 99.99
}
```

#### Admin Only

```http
GET /api/products/admin-only
```

## 💻 استخدام Frontend

### 1. تضمين Auth Utility

```html
<script src="/auth-utils.js"></script>
```

### 2. إنشاء Auth Instance

```javascript
const auth = new HttpOnlyAuth("http://localhost:1337");
```

### 3. تسجيل الدخول

```javascript
try {
  const result = await auth.login("user@example.com", "password123");
  console.log("مرحباً", result.user.username);
} catch (error) {
  console.error("فشل تسجيل الدخول:", error.message);
}
```

### 4. الطلبات المحمية

```javascript
try {
  // الحصول على المستخدم الحالي
  const user = await auth.getCurrentUser();

  // اختبار المصادقة
  const testResult = await auth.testAuth();

  // الحصول على بيانات محمية
  const protectedData = await auth.getProtectedData();

  // فحص الصلاحية
  const canCreate = await auth.checkPermission(
    "create",
    "api::product.product"
  );

  // فحص الدور
  const isAdmin = await auth.checkRole("admin");
} catch (error) {
  console.error("فشل الطلب:", error.message);
}
```

### 5. تسجيل الخروج

```javascript
try {
  await auth.logout();
  console.log("تم تسجيل الخروج بنجاح");
} catch (error) {
  console.error("فشل تسجيل الخروج:", error.message);
}
```

## 🧪 الاختبار

### 1. صفحة الاختبار الشاملة

افتح المتصفح واذهب إلى:

```
http://localhost:1337/test-httponly-complete.html
```

### 2. اختبارات Console

افتح Developer Tools (F12) واذهب إلى Console:

```javascript
// إنشاء auth instance
const auth = new HttpOnlyAuth("http://localhost:1337");

// تسجيل الدخول
await auth.login("test@example.com", "password123");

// اختبار المصادقة
await auth.testAuth();

// فحص الصلاحيات
await auth.checkPermission("create", "api::product.product");

// فحص الأدوار
await auth.checkRole("admin");
```

### 3. اختبار الأمان

```javascript
// فحص الـ Cookies (يجب أن تكون غير مرئية)
console.log(document.cookie);

// محاولة الوصول إلى JWT cookie
const jwtCookie = document.cookie
  .split(";")
  .find((c) => c.trim().startsWith("jwt="));
console.log("JWT Cookie:", jwtCookie); // يجب أن يكون undefined
```

## 🔒 الأمان

### 1. HttpOnly Flag

- يمنع الوصول إلى الـ cookies من JavaScript
- يحمي من هجمات XSS

### 2. Secure Flag

- يضمن إرسال الـ cookies عبر HTTPS فقط في الإنتاج
- يحمي من هجمات Man-in-the-Middle

### 3. SameSite Flag

- يمنع إرسال الـ cookies في الطلبات Cross-Site
- يحمي من هجمات CSRF

### 4. Token Expiration

- الـ tokens تنتهي صلاحيتها بعد 30 يوم
- تحديث تلقائي للـ tokens

## 🚨 استكشاف الأخطاء

### 1. CORS Errors

**المشكلة**: فشل الطلبات Cross-Origin

**الحل**: تأكد من إعدادات CORS في `config/middlewares.js`:

```javascript
{
  name: "strapi::cors",
  config: {
    origin: "*",
    credentials: true, // مهم للـ cookies
  },
}
```

### 2. Cookies Not Sent

**المشكلة**: الـ cookies لا تُرسل مع الطلبات

**الحل**: تأكد من إضافة `credentials: 'include'` في جميع الطلبات:

```javascript
fetch("/api/auth/me", {
  credentials: "include", // مهم!
});
```

### 3. Authentication Fails

**المشكلة**: أخطاء 401 على الـ endpoints المحمية

**الحل**:

- تأكد من وجود المستخدم
- تأكد من أن المستخدم غير محظور
- تأكد من تأكيد البريد الإلكتروني

### 4. Development vs Production

**المشكلة**: سلوك مختلف في الإنتاج

**الحل**: تأكد من إعدادات البيئة:

```javascript
secure: process.env.NODE_ENV === "production";
```

## 📚 المراجع

- [Strapi Authentication Documentation](https://docs.strapi.io/dev-docs/plugins/users-permissions)
- [MDN HttpOnly Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#restrict_access_to_cookies)
- [OWASP Security Guidelines](https://owasp.org/www-project-cheat-sheets/cheatsheets/Authentication_Cheat_Sheet.html)

## 🤝 المساهمة

إذا وجدت أي مشاكل أو لديك اقتراحات، يرجى إنشاء issue في المشروع.

## 📄 الترخيص

هذا المشروع مرخص تحت MIT License.
