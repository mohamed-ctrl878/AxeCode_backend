# HttpOnly Cookies Authentication Guide

This guide explains how to use HttpOnly cookies for secure authentication in your Strapi application.

## 🚀 Quick Start

### 1. Start the Server

```bash
cd axe-code
npm run dev
```

### 2. Test Authentication

Open your browser and go to: `http://localhost:1337/test-auth.html`

## 🔐 How HttpOnly Cookies Work

### Security Benefits

- **XSS Protection**: JavaScript cannot access HttpOnly cookies
- **Automatic Transmission**: Cookies are sent with every request
- **Server-Side Control**: Token management is handled server-side

### Cookie Configuration

```javascript
// Set in config/middlewares.js
{
  name: "strapi::jwt",
  config: {
    httpOnly: true,        // Prevents JavaScript access
    secure: true,          // HTTPS only in production
    sameSite: "strict",    // CSRF protection
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}
```

## 📡 API Endpoints

### Authentication Endpoints

#### Login

```javascript
POST /api/auth/login
Content-Type: application/json

{
  "identifier": "user@example.com",
  "password": "password123"
}
```

#### Logout

```javascript
POST / api / auth / logout;
// Requires authentication
```

#### Get Current User

```javascript
GET / api / auth / me;
// Requires authentication
```

#### Refresh Token

```javascript
POST / api / auth / refresh;
// Requires authentication
```

### Protected Endpoints

#### Test Authentication

```javascript
GET / api / products / test - auth;
// Requires authentication
```

#### Get Protected Data

```javascript
GET / api / products / protected - data;
// Requires authentication
```

#### Execute Code

```javascript
POST /api/code-execution
// Requires authentication

{
  "language": "cpp",
  "code": "int main() { return 0; }",
  "testCases": [],
  "functionName": "main",
  "functionReturnType": "int",
  "expected": [0]
}
```

## 💻 Frontend Implementation

### Using the Auth Utility

```javascript
// Include the utility
<script src="/auth-utils.js"></script>;

// Create auth instance
const auth = new HttpOnlyAuth("http://localhost:1337");

// Login
try {
  const result = await auth.login("user@example.com", "password123");
  console.log("Welcome", result.user.username);
} catch (error) {
  console.error("Login failed:", error.message);
}

// Make authenticated requests
try {
  const user = await auth.getCurrentUser();
  const testResult = await auth.testAuth();
  const protectedData = await auth.getProtectedData();
} catch (error) {
  console.error("Request failed:", error.message);
}

// Logout
try {
  await auth.logout();
  console.log("Logged out successfully");
} catch (error) {
  console.error("Logout failed:", error.message);
}
```

### Manual Implementation

```javascript
// Login
const loginResponse = await fetch("http://localhost:1337/api/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    identifier: "user@example.com",
    password: "password123",
  }),
  credentials: "include", // Important for HttpOnly cookies
});

// Authenticated request
const response = await fetch("http://localhost:1337/api/products/test-auth", {
  credentials: "include", // Important for HttpOnly cookies
});
```

## 🔧 Configuration

### Environment Variables

Make sure you have these in your `.env` file:

```env
JWT_SECRET=your-jwt-secret-here
ADMIN_JWT_SECRET=your-admin-jwt-secret-here
```

### CORS Configuration

For cross-origin requests, update your CORS settings in `config/middlewares.js`:

```javascript
{
  name: 'strapi::cors',
  config: {
    enabled: true,
    origin: ['http://localhost:3000', 'http://localhost:1337'],
    credentials: true // Important for cookies
  }
}
```

## 🛡️ Security Features

### 1. HttpOnly Flag

- Prevents JavaScript access to cookies
- Protects against XSS attacks

### 2. Secure Flag

- Ensures cookies are only sent over HTTPS in production
- Prevents man-in-the-middle attacks

### 3. SameSite Flag

- Prevents CSRF attacks
- Controls when cookies are sent

### 4. Automatic Token Refresh

- Tokens are automatically refreshed
- Seamless user experience

## 🧪 Testing

### 1. Browser Developer Tools

1. Open Developer Tools (F12)
2. Go to Application/Storage tab
3. Check Cookies section
4. Verify `jwt` cookie has `HttpOnly` flag

### 2. Test Authentication Flow

1. Visit `http://localhost:1337/test-auth.html`
2. Login with valid credentials
3. Test protected endpoints
4. Verify logout clears cookies

### 3. Security Testing

```javascript
// This should NOT work (HttpOnly protection)
console.log(document.cookie); // jwt cookie should not be visible

// This should work (automatic cookie transmission)
fetch("/api/auth/me", { credentials: "include" });
```

## 🚨 Common Issues

### 1. CORS Errors

**Problem**: Cross-origin requests fail
**Solution**: Ensure CORS is configured with `credentials: true`

### 2. Cookies Not Sent

**Problem**: Cookies not included in requests
**Solution**: Always include `credentials: 'include'` in fetch requests

### 3. Authentication Fails

**Problem**: 401 errors on protected endpoints
**Solution**: Check if user exists and is not blocked

### 4. Development vs Production

**Problem**: Different behavior in production
**Solution**: Ensure `secure: true` only in production environment

## 📚 Additional Resources

- [Strapi Authentication Documentation](https://docs.strapi.io/dev-docs/plugins/users-permissions)
- [MDN HttpOnly Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#restrict_access_to_cookies)
- [OWASP Security Guidelines](https://owasp.org/www-project-cheat-sheets/cheatsheets/Authentication_Cheat_Sheet.html)

## 🔄 Migration from Authorization Headers

If you're migrating from Authorization headers:

1. **Update Frontend**: Replace Authorization headers with `credentials: 'include'`
2. **Remove Token Storage**: Don't store JWT in localStorage/sessionStorage
3. **Update API Calls**: Use the new authentication utility
4. **Test Thoroughly**: Verify all endpoints work with cookies

## ✅ Best Practices

1. **Always use `credentials: 'include'`** in fetch requests
2. **Don't store JWT tokens** in client-side storage
3. **Use HTTPS in production** for secure cookie transmission
4. **Implement proper error handling** for authentication failures
5. **Regular token refresh** for long-lived sessions
6. **Monitor authentication logs** for security issues
