# reCAPTCHA Integration Setup

This document explains how to configure and use reCAPTCHA in your Strapi application.

## Overview

reCAPTCHA has been integrated into the authentication system to provide additional security against automated attacks and bots. The integration includes:

1. **Backend (Strapi)**: reCAPTCHA token verification service
2. **Frontend (React)**: reCAPTCHA component integration in the login form

## Configuration

### 1. Backend Configuration (Strapi)

#### Environment Variables

Create a `.env` file in your Strapi root directory with the following variables:

```env
# reCAPTCHA Configuration
RECAPTCHA_SECRET_KEY=your-recaptcha-secret-key-here
RECAPTCHA_REQUIRED=true
```

**Variables Explanation:**
- `RECAPTCHA_SECRET_KEY`: Your reCAPTCHA secret key from Google reCAPTCHA console
- `RECAPTCHA_REQUIRED`: Set to `true` to make reCAPTCHA mandatory for login, `false` to make it optional

#### Getting reCAPTCHA Keys

1. Visit [Google reCAPTCHA Console](https://www.google.com/recaptcha/admin)
2. Create a new site or use existing one
3. Choose reCAPTCHA type (v2 or v3)
4. Add your domains (localhost for development)
5. Get your site key and secret key

### 2. Frontend Configuration (React)

#### Environment Variables

Create a `.env` file in your frontend directory:

```env
# reCAPTCHA Configuration
REACT_APP_RECAPTCHA_SITE_KEY=6Ld_GM8rAAAAAK_dyi6p7ndKZKG1kaWqJwupvEJn
```

**Note**: The site key provided in the code (`6Ld_GM8rAAAAAK_dyi6p7ndKZKG1kaWqJwupvEJn`) is the one you specified. Make sure you have the corresponding secret key for the backend.

## How It Works

### Backend Flow

1. **Login Request**: Client sends login request with identifier, password, and reCAPTCHA token
2. **Token Verification**: Strapi verifies the reCAPTCHA token with Google's API
3. **Validation**: If reCAPTCHA is valid, proceed with normal authentication
4. **Response**: Return appropriate response based on verification result

### Frontend Flow

1. **User Interaction**: User fills login form and completes reCAPTCHA
2. **Token Generation**: reCAPTCHA component generates a token
3. **Form Submission**: Login form includes the reCAPTCHA token in the request
4. **Error Handling**: Display appropriate messages for reCAPTCHA failures

## Files Modified/Added

### Backend Files

1. **`src/api/auth/services/recaptcha-service.js`** - New reCAPTCHA verification service
2. **`src/api/auth/controllers/auth.js`** - Updated login method with reCAPTCHA verification

### Frontend Files

1. **`src/components/ReCaptcha/ReCaptcha.js`** - New reusable reCAPTCHA component
2. **`src/components/Auth/LoginForm.js`** - Updated login form with reCAPTCHA integration
3. **`src/hooks/useAuth.js`** - Updated authentication hook to handle reCAPTCHA tokens
4. **`package.json`** - Added `react-google-recaptcha` dependency

## API Changes

### Login Endpoint

**URL**: `POST /api/auth/login`

**Request Body**:
```json
{
  "identifier": "user@example.com",
  "password": "password123",
  "recaptchaToken": "03AGdBq26..."
}
```

**Response Examples**:

**Success**:
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "user",
    "email": "user@example.com",
    "confirmed": true,
    "blocked": false
  }
}
```

**reCAPTCHA Failed**:
```json
{
  "error": "recaptcha_failed",
  "message": "reCAPTCHA verification failed",
  "details": "Please complete the reCAPTCHA verification"
}
```

## Testing

### Development Testing

1. Start your Strapi backend: `npm run dev`
2. Start your React frontend: `cd frontend && npm start`
3. Navigate to the login page
4. Complete the reCAPTCHA and attempt login

### Production Considerations

1. **HTTPS**: reCAPTCHA requires HTTPS in production
2. **Domain Configuration**: Add your production domain to reCAPTCHA console
3. **Rate Limiting**: Consider implementing additional rate limiting
4. **Monitoring**: Monitor reCAPTCHA verification success rates

## Security Features

1. **Token Verification**: Each reCAPTCHA token is verified with Google's API
2. **Single Use**: reCAPTCHA tokens can only be used once
3. **Score Threshold**: For reCAPTCHA v3, configurable score threshold
4. **IP Tracking**: Client IP is included in verification for additional security
5. **Error Handling**: Comprehensive error handling and logging

## Troubleshooting

### Common Issues

1. **Invalid Site Key**: Ensure the site key matches your reCAPTCHA configuration
2. **Domain Mismatch**: Make sure your domain is registered in reCAPTCHA console
3. **Network Issues**: Check if your server can reach Google's reCAPTCHA API
4. **Token Expiration**: reCAPTCHA tokens expire after a few minutes

### Debugging

Enable debug logging in your Strapi configuration to see reCAPTCHA verification attempts and results.

## Future Enhancements

1. Support for invisible reCAPTCHA
2. Integration with registration form
3. Configurable score thresholds
4. Analytics and reporting
5. Fallback verification methods

## Support

For issues related to reCAPTCHA integration, check:
1. Google reCAPTCHA documentation
2. Strapi authentication documentation  
3. React-google-recaptcha library documentation