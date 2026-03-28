"use strict";

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::submission.submission", ({ strapi }) => ({
  /**
   * Securely find submissions for the current user
   */
  /**
   * Securely find submissions for the current user bypassing strict REST query validators.
   */
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('You must be logged in');

    // Extract custom query params
    let problemDocId = null;
    if (ctx.query.filters && ctx.query.filters.problem && ctx.query.filters.problem.documentId) {
        problemDocId = ctx.query.filters.problem.documentId;
    }

    // Build the query object for the Service API directly
    const serviceQuery = { ...ctx.query };
    
    serviceQuery.filters = {
      user: { id: user.id }
    };

    if (problemDocId) {
      serviceQuery.filters.problem = { documentId: problemDocId };
    }

    // Call the Service layer directly -> Avoids super.find() REST Validation
    const { results, pagination } = await strapi.service('api::submission.submission').find(serviceQuery);
    
    // Sanitize and transform to standard REST format
    const sanitizedResults = await this.sanitizeOutput(results, ctx);
    return this.transformResponse(sanitizedResults, { pagination });
  },

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
