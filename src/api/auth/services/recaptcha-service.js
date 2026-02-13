"use strict";

const axios = require('axios');

/**
 * reCAPTCHA service
 * Service for verifying reCAPTCHA tokens with Google's reCAPTCHA API
 */

module.exports = () => ({
  /**
   * Verify reCAPTCHA token with Google's reCAPTCHA API
   */
  async verifyRecaptcha(token, remoteip = null) {
    try {
      const secretKey = process.env.RECAPTCHA_SECRET_KEY;
      
      if (!secretKey) {
        strapi.log.error('reCAPTCHA secret key is not configured in environment variables');
        throw new Error('reCAPTCHA configuration error');
      }

      if (!token) {
        throw new Error('reCAPTCHA token is required');
      }

      const requestData = {
        secret: secretKey,
        response: token,
      };

      if (remoteip) {
        requestData.remoteip = remoteip;
      }

      const response = await axios({
        method: 'POST',
        url: 'https://www.google.com/recaptcha/api/siteverify',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: new URLSearchParams(requestData).toString(),
        timeout: 10000,
      });

      const verificationResult = response.data;

      strapi.log.info(`reCAPTCHA verification attempt: ${verificationResult.success ? 'SUCCESS' : 'FAILED'}`);

      return {
        success: verificationResult.success,
        score: verificationResult.score || null,
        errorCodes: verificationResult['error-codes'] || [],
      };

    } catch (error) {
      strapi.log.error('reCAPTCHA verification failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Validate reCAPTCHA verification result
   */
  isValidVerification(verificationResult, minScore = 0.5) {
    if (!verificationResult.success) return false;
    if (verificationResult.score !== null && verificationResult.score < minScore) {
      strapi.log.warn(`reCAPTCHA score ${verificationResult.score} is below threshold ${minScore}`);
      return false;
    }
    return true;
  },

  /**
   * Extract client IP from request context
   */
  getClientIP(ctx) {
    try {
      const forwarded = ctx.request.headers['x-forwarded-for'];
      if (forwarded) return forwarded.split(',')[0].trim();
      return ctx.request.headers['x-real-ip'] || ctx.request.ip || null;
    } catch (error) {
      return null;
    }
  },

  /**
   * High-level validation for controllers (DRY)
   */
  async validate(ctx) {
    const { recaptchaToken } = ctx.request.body;
    const isRequired = process.env.RECAPTCHA_REQUIRED === 'true';

    // If not required and no token provided, pass
    if (!recaptchaToken && !isRequired) return true;
    
    // If required but missing, fail
    if (!recaptchaToken && isRequired) {
        strapi.log.warn('[reCAPTCHA] Validation failed: Token missing');
        return false;
    }

    const clientIP = this.getClientIP(ctx);
    const verification = await this.verifyRecaptcha(recaptchaToken, clientIP);
    return this.isValidVerification(verification);
  }
});