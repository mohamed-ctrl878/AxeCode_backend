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
    const authService = strapi.service('api::auth.auth-service');
    
    // 1. Identity Creation (AuthService)
    // We'll modify AuthService to ONLY handle user creation soon.
    const { jwt, user } = await authService.register(ctx, userData);

    // 2. Social Integration (Messaging)
    if (user.university) {
      await this.joinUniversityCommunity(user);
    }

    // 3. Resource Allocation (Optional: Welcome Gift/Entitlement)
    // Here we could call EntitlementService to grant a free "Starter Bundle"
    
    return { jwt, user };
  },

  /**
   * Helper to join university rooms (Social Logic)
   */
  async joinUniversityCommunity(user) {
    try {
      const univConv = await strapi.db.query('api::conversation.conversation').findOne({ 
        where: { title: user.university } 
      });

      if (univConv) {
        strapi.log.info(`[Onboarding] Joining user ${user.username} to ${user.university}`);
        await strapi.db.query('api::conversation.conversation').update({
          where: { id: univConv.id },
          data: { members: { connect: [user.id] } }
        });
      }
    } catch (err) {
      strapi.log.error(`[Onboarding] Social integration error: ${err.message}`);
    }
  }
});
