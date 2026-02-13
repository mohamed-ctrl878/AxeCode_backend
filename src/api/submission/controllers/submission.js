"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::submission.submission", ({ strapi }) => ({
  /**
   * Handle code submission
   */
  async create(ctx) {
    const { problem, code, language } = ctx.request.body.data;
    const user = ctx.state.user;
    
    if (!problem || !code || !language) {
      return ctx.badRequest('Missing required fields: problem, code, or language');
    }

    try {
      // 1. Create initial submission record (Draft/Pending)
      const submission = await strapi.documents('api::submission.submission').create({
        data: {
          problem,
          code,
          language,
          user: user ? user.id : null,
          verdict: 'pending'
        }
      });
      
      // 2. Delegate background processing to Logic Service (SRP)
      strapi.service('api::submission.submission-logic').queueSubmission(submission.documentId);
      
      // 3. Return fast response (Async Pattern)
      return {
        data: submission,
        message: 'Submission received and is being processed'
      };
    } catch (error) {
      strapi.log.error('[SubmissionController] Create Error:', error);
      return ctx.internalServerError('Failed to initiate submission');
    }
  },

  /**
   * Quick test submission (Bypasses some checks/auth)
   */
  async testSubmit(ctx) {
     const { problem, code, language } = ctx.request.body.data;
     if (!problem || !code || !language) return ctx.badRequest('Missing fields');

     const result = await strapi.documents('api::submission.submission').create({
         data: { problem, code, language, verdict: 'pending' }
     });
     
     strapi.service('api::submission.submission-logic').queueSubmission(result.documentId);
     
     return { data: result, message: 'Test submission queued' };
  }
}));
