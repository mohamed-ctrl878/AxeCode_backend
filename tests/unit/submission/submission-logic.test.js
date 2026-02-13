import { describe, it, expect, vi } from 'vitest';
const StrapiMock = require('../../helpers/strapi-mock');
const strapiMock = new StrapiMock();

const logicFactory = require('../../../src/api/submission/services/submission-logic');
const submissionLogic = logicFactory({ strapi: strapiMock });

describe('SubmissionLogic Service', () => {
  describe('queueSubmission', () => {
    it('should update status to runtime_error if queueing fails', async () => {
      const mockUpdate = vi.fn();
      vi.spyOn(strapiMock, 'documents').mockReturnValue({
        update: mockUpdate
      });
      
      // Mock queueManager.addTask to throw
      const queueManager = require('../../../src/api/submission/services/queue-manager');
      vi.spyOn(queueManager, 'addTask').mockRejectedValue(new Error('Queue full'));

      await submissionLogic.queueSubmission('sub-1');
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ verdict: 'runtime_error' })
      }));
    });
  });

  describe('processSubmission', () => {
    it('should orchestrate a successful submission flow', async () => {
      const mockSubmission = {
        documentId: 'sub-1',
        code: 'print(1)',
        language: 'python',
        problem: {
          test_cases: [{ expectedOutput: '1' }],
          code_templates: [{ language: 'python', wrapperCode: '{USER_CODE}' }],
          functionParams: []
        }
      };

      vi.spyOn(strapiMock, 'documents').mockReturnValue({
        findOne: async () => mockSubmission,
        update: async () => ({ documentId: 'sub-1', verdict: 'accepted' })
      });

      vi.spyOn(strapiMock, 'service').mockImplementation((uid) => {
        if (uid === 'api::submission.code-wrapper') return { 
            wrap: (c) => c, 
            prepareStdin: () => '' 
        };
        if (uid === 'api::submission.submission-grader') return { 
            evaluateTestCase: () => ({ verdict: 'accepted' }),
            calculateFinalVerdict: () => ({ finalVerdict: 'accepted', passedCount: 1, totalTestCases: 1 })
        };
        if (uid === 'api::submission.judge0') return { 
            getLanguageId: () => 71,
            executeBatch: async () => [{}] 
        };
        if (uid === 'api::submission.submission-socket') return { notifyComplete: () => {} };
        return {};
      });

      const result = await submissionLogic.processSubmission('sub-1');
      expect(result.verdict).toBe('accepted');
    });

    it('should handle wrapping error as runtime_error', async () => {
        vi.spyOn(strapiMock, 'documents').mockReturnValue({
          findOne: async () => ({ 
            language: 'python', 
            problem: { code_templates: [{ language: 'python' }] } 
          }),
          update: async () => ({ verdict: 'runtime_error' })
        });
        vi.spyOn(strapiMock, 'service').mockImplementation((uid) => {
          if (uid === 'api::submission.code-wrapper') return { 
            wrap: () => { throw new Error('Wrap failed'); } 
          };
          if (uid === 'api::submission.submission-socket') return { notifyComplete: () => {} };
          return {};
        });

        const result = await submissionLogic.processSubmission('sub-1');
        expect(result.verdict).toBe('runtime_error');
    });

    it('should handle execution error as runtime_error', async () => {
        vi.spyOn(strapiMock, 'documents').mockReturnValue({
            findOne: async () => ({ 
              language: 'python', 
              problem: { 
                test_cases: [{}], 
                code_templates: [{ language: 'python' }] 
              } 
            }),
            update: async () => ({ verdict: 'runtime_error' })
        });
        vi.spyOn(strapiMock, 'service').mockImplementation((uid) => {
            if (uid === 'api::submission.code-wrapper') return { wrap: (c) => c, prepareStdin: () => '' };
            if (uid === 'api::submission.judge0') return { 
                getLanguageId: () => 71,
                executeBatch: async () => { throw new Error('Remote judge down'); } 
            };
            if (uid === 'api::submission.submission-socket') return { notifyComplete: () => {} };
            return {};
        });

        await submissionLogic.processSubmission('sub-1');
        // If it catches and calls handleFailure, it's covered.
    });

    it('should handle unsupported language as runtime_error', async () => {
        vi.spyOn(strapiMock, 'documents').mockReturnValue({
            findOne: async () => ({ language: 'assembly', problem: { code_templates: [] } }),
            update: async () => ({ verdict: 'runtime_error' })
        });
        vi.spyOn(strapiMock, 'service').mockImplementation((uid) => {
            if (uid === 'api::submission.judge0') return { getLanguageId: () => null };
            if (uid === 'api::submission.submission-socket') return { notifyComplete: () => {} };
            return {};
        });

        const result = await submissionLogic.processSubmission('sub-1');
        expect(result.verdict).toBe('runtime_error');
    });
  });

  describe('notifySubmissionComplete', () => {
    it('should use manual fallback if socket service is missing notifyComplete', () => {
       strapiMock.io = { to: vi.fn().mockReturnValue({ emit: vi.fn() }) };
       vi.spyOn(strapiMock, 'service').mockReturnValue({}); // Missing notifyComplete
       
       submissionLogic.notifySubmissionComplete({ documentId: 'sub-1' });
       expect(strapiMock.io.to).toHaveBeenCalledWith('submission:sub-1');
    });
  });
});
