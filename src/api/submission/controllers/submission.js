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
    const loggedInUser = ctx.state.user;
    
    // Build the query object for the Service API
    const serviceQuery = { ...ctx.query };
    const incomingFilters = ctx.query.filters || {};

    // Logic: 
    // 1. If user filter is explicitly provided (e.g., username in profile page), use it.
    // 2. Otherwise, if logged in, default to current user.
    
    let activeFilters = { ...incomingFilters };

    if (!activeFilters.user && loggedInUser) {
        // Default to self if no specific user requested
        activeFilters.user = { id: loggedInUser.id };
    }

    if (!activeFilters.user && !loggedInUser) {
        return ctx.badRequest('You must specify a user filter or be logged in to view submissions.');
    }

    serviceQuery.filters = activeFilters;

    // Call the Service layer directly
    const { results, pagination } = await strapi.service('api::submission.submission').find(serviceQuery);
    
    // 🛡️ Privacy Layer: Sanitize output and hide 'code' if requester is not author
    const processedResults = results.map(item => {
        // Note: Relation might be populated or just an ID depending on query
        const ownerId = item.user?.id || item.user;
        const isOwner = loggedInUser && (ownerId === loggedInUser.id);
        
        // If not owner, hide sensitive fields
        if (!isOwner) {
            return {
                ...item,
                code: '/* Private Code */',
                judgeOutput: { results: [] } 
            };
        }
        return item;
    });

    const sanitizedResults = await this.sanitizeOutput(processedResults, ctx);
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
