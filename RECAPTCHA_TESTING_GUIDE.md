# reCAPTCHA Testing Guide

## 🎯 Main Testing Endpoint

**Primary Endpoint**: `POST http://localhost:1338/api/auth/login`

This is the main endpoint where reCAPTCHA verification has been integrated.

## 🔧 Server Configuration

Based on your current setup:
- **Host**: `0.0.0.0` (accepts connections from any IP)
- **Port**: `1338` (configured in config/server.js)
- **Base URL**: `http://localhost:1338`
- **API Prefix**: `/api` (Strapi default)

## 📝 Testing Methods

### Method 1: Using cURL (Command Line)

#### Test with reCAPTCHA Token
```bash
curl -X POST http://localhost:1338/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "test@example.com",
    "password": "password123",
    "recaptchaToken": "03AGdBq26..."
  }'
```

#### Test without reCAPTCHA Token (should fail if required)
```bash
curl -X POST http://localhost:1338/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "test@example.com",
    "password": "password123"
  }'
```

### Method 2: Using PowerShell (Windows)

#### With reCAPTCHA Token
```powershell
$headers = @{
    "Content-Type" = "application/json"
}

$body = @{
    identifier = "test@example.com"
    password = "password123"
    recaptchaToken = "03AGdBq26_test_token_here"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:1338/api/auth/login" -Method POST -Headers $headers -Body $body
```

#### Without reCAPTCHA Token
```powershell
$headers = @{
    "Content-Type" = "application/json"
}

$body = @{
    identifier = "test@example.com"
    password = "password123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:1338/api/auth/login" -Method POST -Headers $headers -Body $body
```

### Method 3: Using Postman

#### Request Configuration
- **Method**: `POST`
- **URL**: `http://localhost:1338/api/auth/login`
- **Headers**: 
  ```
  Content-Type: application/json
  ```
- **Body** (raw JSON):
  ```json
  {
    "identifier": "test@example.com",
    "password": "password123",
    "recaptchaToken": "03AGdBq26_your_token_here"
  }
  ```

### Method 4: Using the Frontend Form

1. Start your Strapi backend:
   ```bash
   cd D:\tst
   npm run dev
   ```

2. Start your React frontend:
   ```bash
   cd D:\tst\frontend
   npm start
   ```

3. Navigate to the login form in your browser
4. Fill out the form and complete the reCAPTCHA
5. Submit the form

## 🧪 Test Scenarios

### Scenario 1: Valid reCAPTCHA Token
**Expected Result**: Successful login
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "user",
    "email": "test@example.com",
    "confirmed": true,
    "blocked": false
  }
}
```

### Scenario 2: Missing reCAPTCHA Token (when required)
**Expected Result**: Error response
```json
{
  "error": "recaptcha_missing",
  "message": "reCAPTCHA verification is required",
  "details": "Please complete the reCAPTCHA verification"
}
```

### Scenario 3: Invalid reCAPTCHA Token
**Expected Result**: Error response
```json
{
  "error": "recaptcha_failed",
  "message": "reCAPTCHA verification failed",
  "details": "Please complete the reCAPTCHA verification"
}
```

### Scenario 4: Expired reCAPTCHA Token
**Expected Result**: Error response
```json
{
  "error": "recaptcha_failed",
  "message": "reCAPTCHA verification failed",
  "details": "Please complete the reCAPTCHA verification"
}
```

## 🔑 Getting Real reCAPTCHA Tokens

### For Development Testing

1. **Open Browser Developer Tools**
2. **Navigate to a page with reCAPTCHA**
3. **Complete the reCAPTCHA challenge**
4. **Check Network Tab** for the token in the request
5. **Copy the token** for API testing

### Using reCAPTCHA Test Keys (Google Provided)

Google provides test keys that always pass/fail:

**Always Passes (for testing success scenario):**
- Site Key: `6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI`
- Secret Key: `6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe`

**Always Fails (for testing failure scenario):**
- Site Key: `6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI`
- Secret Key: `6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe` (same keys, but you can send invalid tokens)

## 🚀 Quick Test Script

Create a test script to quickly verify the endpoint:

### PowerShell Test Script
```powershell
# Save as test-recaptcha.ps1
$baseUrl = "http://localhost:1338/api/auth/login"

Write-Host "Testing reCAPTCHA endpoint..." -ForegroundColor Green

# Test 1: Without reCAPTCHA token
Write-Host "`n1. Testing without reCAPTCHA token:" -ForegroundColor Yellow
try {
    $response1 = Invoke-RestMethod -Uri $baseUrl -Method POST -Headers @{"Content-Type"="application/json"} -Body (@{
        identifier = "test@example.com"
        password = "password123"
    } | ConvertTo-Json)
    Write-Host "Unexpected success: $($response1 | ConvertTo-Json)" -ForegroundColor Red
} catch {
    Write-Host "Expected failure: $($_.Exception.Message)" -ForegroundColor Green
}

# Test 2: With invalid reCAPTCHA token
Write-Host "`n2. Testing with invalid reCAPTCHA token:" -ForegroundColor Yellow
try {
    $response2 = Invoke-RestMethod -Uri $baseUrl -Method POST -Headers @{"Content-Type"="application/json"} -Body (@{
        identifier = "test@example.com"
        password = "password123"
        recaptchaToken = "invalid_token_123"
    } | ConvertTo-Json)
    Write-Host "Unexpected success: $($response2 | ConvertTo-Json)" -ForegroundColor Red
} catch {
    Write-Host "Expected failure: $($_.Exception.Message)" -ForegroundColor Green
}

Write-Host "`nTesting complete!" -ForegroundColor Green
```

### Run the test script:
```powershell
cd D:\tst
.\test-recaptcha.ps1
```

## 📊 Environment Variables for Testing

Make sure these are set in your `.env` file:

```env
# Backend (.env in root directory)
RECAPTCHA_SECRET_KEY=your-secret-key-here
RECAPTCHA_REQUIRED=true

# Frontend (.env in frontend directory)
REACT_APP_RECAPTCHA_SITE_KEY=6Ld_GM8rAAAAAK_dyi6p7ndKZKG1kaWqJwupvEJn
```

## 🔍 Debugging Tips

### 1. Check Server Logs
```bash
cd D:\tst
npm run dev
# Watch for reCAPTCHA verification logs
```

### 2. Enable Debug Logging
Add to your Strapi `config/logger.js`:
```javascript
module.exports = {
  level: 'debug',
  transports: [
    {
      type: 'console',
      level: 'debug'
    }
  ]
};
```

### 3. Network Debugging
- Use browser Developer Tools → Network tab
- Check request/response headers and body
- Verify the reCAPTCHA token format

### 4. Common Issues & Solutions

**Issue**: "RECAPTCHA_SECRET_KEY not configured"
**Solution**: Set the environment variable in `.env`

**Issue**: "reCAPTCHA verification failed" with valid token
**Solution**: Check if the secret key matches the site key

**Issue**: Network timeout
**Solution**: Check internet connection to Google's reCAPTCHA API

**Issue**: CORS errors in browser
**Solution**: Configure CORS in Strapi middleware settings

## 🎯 Testing Checklist

- [ ] Server is running on port 1338
- [ ] Environment variables are configured
- [ ] Can reach the endpoint with basic auth (no reCAPTCHA)
- [ ] reCAPTCHA service returns expected errors
- [ ] Valid reCAPTCHA tokens work correctly
- [ ] Invalid tokens are properly rejected
- [ ] Frontend form integration works
- [ ] Mobile responsiveness tested
- [ ] Error messages display correctly
- [ ] Token expiration handling works

## 📞 Support

If you encounter issues:
1. Check the server logs for detailed error messages
2. Verify environment variables are correctly set
3. Test with Google's test keys first
4. Use the browser's network tab to inspect requests
5. Refer to the RECAPTCHA_SETUP.md for configuration details