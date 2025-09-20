"use strict";

const axios = require('axios');

/**
 * reCAPTCHA service
 * Service for verifying reCAPTCHA tokens with Google's reCAPTCHA API
 */

module.exports = () => ({
  /**
   * Verify reCAPTCHA token with Google's reCAPTCHA API
   * @param {string} token - The reCAPTCHA token from the frontend
   * @param {string} remoteip - Optional: The user's IP address
   * @returns {Promise<Object>} - Verification result from Google
   */
  async verifyRecaptcha(token, remoteip = null) {
    try {
      // Get the secret key from environment variables
      const secretKey = process.env.RECAPTCHA_SECRET_KEY;
      
      if (!secretKey) {
        strapi.log.error('reCAPTCHA secret key is not configured in environment variables');
        throw new Error('reCAPTCHA configuration error');
      }

      if (!token) {
        throw new Error('reCAPTCHA token is required');
      }

      // Prepare the request data for Google's reCAPTCHA API
      const requestData = {
        secret: secretKey,
        response: token,
      };

      // Add remote IP if provided
      if (remoteip) {
        requestData.remoteip = remoteip;
      }

      // Make request to Google's reCAPTCHA verification API
      const response = await axios({
        method: 'POST',
        url: 'https://www.google.com/recaptcha/api/siteverify',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        data: new URLSearchParams(requestData).toString(),
        timeout: 10000, // 10 seconds timeout
      });

      const verificationResult = response.data;

      // Log the verification attempt
      strapi.log.info(`reCAPTCHA verification attempt: ${verificationResult.success ? 'SUCCESS' : 'FAILED'}`, {
        success: verificationResult.success,
        errorCodes: verificationResult['error-codes'] || [],
        score: verificationResult.score || null,
        action: verificationResult.action || null,
      });

      return {
        success: verificationResult.success,
        score: verificationResult.score || null,
        action: verificationResult.action || null,
        errorCodes: verificationResult['error-codes'] || [],
        challengeTs: verificationResult.challenge_ts || null,
        hostname: verificationResult.hostname || null,
      };

    } catch (error) {
      strapi.log.error('reCAPTCHA verification failed:', error);
      
      // Return a failed verification result for any error
      return {
        success: false,
        error: error.message,
        errorCodes: ['verification-failed'],
      };
    }
  },

  /**
   * Validate reCAPTCHA verification result
   * @param {Object} verificationResult - Result from verifyRecaptcha method
   * @param {number} minScore - Minimum score required (for reCAPTCHA v3, default: 0.5)
   * @returns {boolean} - Whether the reCAPTCHA verification is valid
   */
  isValidVerification(verificationResult, minScore = 0.5) {
    if (!verificationResult.success) {
      return false;
    }

    // For reCAPTCHA v3, also check the score
    if (verificationResult.score !== null && verificationResult.score < minScore) {
      strapi.log.warn(`reCAPTCHA score ${verificationResult.score} is below minimum threshold ${minScore}`);
      return false;
    }

    return true;
  },

  /**
   * Extract client IP from request context
   * @param {Object} ctx - Koa context
   * @returns {string|null} - Client IP address
   */
  getClientIP(ctx) {
    try {
      // Try to get IP from various headers (for proxied requests)
      const forwarded = ctx.request.headers['x-forwarded-for'];
      if (forwarded) {
        return forwarded.split(',')[0].trim();
      }

      const realIP = ctx.request.headers['x-real-ip'];
      if (realIP) {
        return realIP;
      }

      // Fallback to connection remote address
      return ctx.request.ip || ctx.request.socket.remoteAddress || null;
    } catch (error) {
      strapi.log.error('Error extracting client IP:', error);
      return null;
    }
  },
});