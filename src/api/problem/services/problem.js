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

    // Derive submission status for the current user
    let submissionStatus = 'New';
    if (userId) {
      const submissions = await strapi.db.query('api::submission.submission').findMany({
        where: {
          problem: { documentId: problem.documentId },
          user: { id: userId },
        },
        select: ['verdict'],
      });
      if (submissions.length > 0) {
        submissionStatus = submissions.some(s => s.verdict === 'accepted') ? 'Solved' : 'Attempted';
      }
    }

    return {
      ...problem,
      interactions,
      submissionStatus,
    };
  }
}));
