const { SUBMISSION_POPULATE } = require('../constants');
const queueManager = require('./queue-manager');

/**
 * Service to handle the logic of code submissions
 */

module.exports = ({ strapi }) => ({
  /**
   * Add a submission to the processing queue
   */
  async queueSubmission(submissionId) {
    strapi.log.info(`[SubmissionLogic] Queuing submission ${submissionId}...`);
    
    try {
      await queueManager.addTask(async () => {
        return await this.processSubmission(submissionId);
      });
    } catch (error) {
      strapi.log.error(`[SubmissionLogic] Failed to queue submission ${submissionId}:`, error);
      
      await strapi.documents('api::submission.submission').update({
        documentId: submissionId,
        data: { 
          verdict: 'runtime_error', 
          judgeOutput: { error: 'Queue full or system error' } 
        }
      });
    }
  },

  async processSubmission(submissionId) {
    const submission = await strapi.documents('api::submission.submission').findOne({
      documentId: submissionId,
      populate: SUBMISSION_POPULATE
    });

    if (!submission || !submission.problem) return;

    const { problem, code, language } = submission;
    const testCases = problem.test_cases || [];

    // specialized services
    const wrapper = strapi.service('api::submission.code-wrapper');
    const grader = strapi.service('api::submission.submission-grader');
    const judge0 = strapi.service('api::submission.judge0');

    // 1. Prepare Code
    const template = problem.code_templates.find(t => t.language === language);
    let fullCode;
    try {
      fullCode = wrapper.wrap(code, template);
    } catch (e) {
      return await this.handleFailure(submissionId, 'runtime_error', e.message);
    }

    const languageId = judge0.getLanguageId(language);
    if (!languageId) return await this.handleFailure(submissionId, 'runtime_error', `Unsupported language: ${language}`);

    // 2. Prepare Batch
    const batchSubmissions = testCases.map(testCase => ({
      languageId,
      sourceCode: fullCode,
      stdin: wrapper.prepareStdin(testCase, problem.functionParams)
    }));

    try {
      // 3. Execute
      const batchResults = await judge0.executeBatch(batchSubmissions);
      
      // 4. Grade
      const results = batchResults.map((exec, idx) => grader.evaluateTestCase(exec, testCases[idx]));
      const finalStats = grader.calculateFinalVerdict(results, testCases.length);

      // 5. Persist
      const updated = await strapi.documents('api::submission.submission').update({
        documentId: submissionId,
        data: {
          verdict: finalStats.finalVerdict,
          testCasesPassed: finalStats.passedCount,
          totalTestCases: finalStats.totalTestCases,
          judgeOutput: { results },
          executionTime: finalStats.executionTime,
          memoryUsed: finalStats.memoryUsed
        }
      });

      this.notifySubmissionComplete(updated);
      return updated;

    } catch (error) {
      strapi.log.error(`[SubmissionLogic] Execution error: ${error.message}`);
      await this.handleFailure(submissionId, 'runtime_error', error.message);
    }
  },

  /**
   * Centralized failure handling
   */
  async handleFailure(submissionId, verdict, error) {
    const updated = await strapi.documents('api::submission.submission').update({
      documentId: submissionId,
      data: { verdict, judgeOutput: { error } }
    });
    
    // Auto-populate user if needed for notification
    const submission = await strapi.documents('api::submission.submission').findOne({
        documentId: submissionId,
        populate: ['user']
    });
    
    this.notifySubmissionComplete(submission);
    return updated;
  },

  /**
   * Delegation to specialized Socket Service
   */
  notifySubmissionComplete(submission) {
    // DRY + SRP: Use the specialized socket service
    const socketService = strapi.service('api::submission.submission-socket');
    if (socketService.notifyComplete) {
       socketService.notifyComplete(submission);
    } else {
       // Manual emit if service is not fully migrated yet
       strapi.log.warn('[SubmissionLogic] notifyComplete not found in socket service, using fallback');
       if (strapi.io) {
          strapi.io.to(`submission:${submission.documentId}`).emit('submission:complete', submission);
       }
    }
  }
});
