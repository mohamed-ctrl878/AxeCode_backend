'use strict';

/**
 * problem service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::problem.problem', ({ strapi }) => ({
  async findForUser(params, userId = null) {
    const { results, pagination } = await super.find(params);

    const enrichedResults = await Promise.all(
      results.map(async (problem) => this.enrichProblem(problem, userId))
    );

    return { results: enrichedResults, pagination };
  },

  async findOneForUser(documentId, userId = null) {
    const problem = await strapi.documents('api::problem.problem').findOne({
      documentId,
      populate: ['problem_types', 'courses', 'test_cases', 'code_templates']
    });

    return this.enrichProblem(problem, userId);
  },

  async enrichProblem(problem, userId = null) {
    if (!problem) return null;
    const interactionFacade = strapi.service('api::rate.interaction-facade');
    const interactions = await interactionFacade.getMetadata('problem', problem.documentId, userId);

    // Derive submission status via optimized server-side queries
    const submissionStatus = await this.deriveSubmissionStatus(problem.documentId, userId);

    // Strip submissions from response — status is derived server-side
    const { submissions, ...cleanProblem } = problem;

    return {
      ...cleanProblem,
      interactions,
      submissionStatus,
    };
  },

  /**
   * Derives the submission status for a user on a specific problem.
   * Uses two focused DB queries for optimal performance:
   *   1. Check for any accepted submission → "Solved"
   *   2. Check for any submission at all  → "Attempted"
   *   3. Otherwise                        → "New"
   *
   * @param {string} problemDocumentId
   * @param {number|null} userId
   * @returns {Promise<'Solved'|'Attempted'|'New'>}
   */
  async deriveSubmissionStatus(problemDocumentId, userId) {
    if (!userId) return 'New';

    const baseWhere = {
      problem: { documentId: problemDocumentId },
      user: { id: userId },
    };

    // Query 1: Does the user have at least one accepted submission?
    const acceptedSubmission = await strapi.db.query('api::submission.submission').findOne({
      where: { ...baseWhere, verdict: 'accepted' },
      select: ['id'],
    });

    if (acceptedSubmission) return 'Solved';

    // Query 2: Does the user have any submission at all?
    const anySubmission = await strapi.db.query('api::submission.submission').findOne({
      where: baseWhere,
      select: ['id'],
    });

    return anySubmission ? 'Attempted' : 'New';
  }
}));
