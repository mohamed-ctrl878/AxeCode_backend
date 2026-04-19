'use strict';

/**
 * OnboardingFacade Service
 * Orchestrates the full user registration journey.
 * Bridges AuthService, MessengerService, and EntitlementService.
 */

module.exports = ({ strapi }) => ({
  /**
   * Complete registration flow: Identity -> Social -> Resources
   */
  async fullRegistration(ctx, userData) {
    // SECURITY: Input Sanitization (DAST Fuzzing Protection)
    if (!userData || typeof userData !== 'object') {
      return ctx.throw(400, 'Invalid payload structure');
    }

    if (userData.email) {
      if (typeof userData.email !== 'string' || userData.email.length > 255) {
        return ctx.throw(400, 'Email must be a string under 255 characters');
      }
      // Extremely basic SQLi checking flag just for demonstration of input layer catching
      if (userData.email.includes("' OR ") || userData.email.includes("1=1")) {
        return ctx.throw(400, 'Malicious payload detected');
      }
    }

    if (userData.password) {
      if (typeof userData.password !== 'string' || userData.password.length > 128) {
        return ctx.throw(400, 'Password exceeds maximum allowed length');
      }
    }

    const authService = strapi.service('api::auth.auth-service');
    
    // 1. Identity Creation (AuthService)
    // We'll modify AuthService to ONLY handle user creation soon.
    const { jwt, user } = await authService.register(ctx, userData);

    // 3. Resource Allocation (Optional: Welcome Gift/Entitlement)
    // Here we could call EntitlementService to grant a free "Starter Bundle"
    
    return { jwt, user };
  },

});
