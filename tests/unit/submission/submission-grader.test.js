import { describe, it, expect } from 'vitest';
const StrapiMock = require('../../helpers/strapi-mock');
const strapiMock = new StrapiMock();

const graderFactory = require('../../../src/api/submission/services/submission-grader');
const grader = graderFactory({ strapi: strapiMock });

describe('SubmissionGrader Service', () => {
  describe('evaluateTestCase', () => {
    it('should return accepted when output matches expected', () => {
      const exec = {
        status: { id: 3 },
        stdout: Buffer.from('"Correct"').toString('base64'),
        time: "0.1",
        memory: "1024"
      };
      const testCase = { expectedOutput: "Correct" };
      
      const result = grader.evaluateTestCase(exec, testCase);
      expect(result.verdict).toBe('accepted');
      expect(result.actualOutput).toBe('Correct');
    });

    it('should return wrong_answer when output does not match', () => {
      const exec = {
        status: { id: 3 },
        stdout: Buffer.from('"Wrong"').toString('base64')
      };
      const testCase = { expectedOutput: "Correct" };
      
      const result = grader.evaluateTestCase(exec, testCase);
      expect(result.verdict).toBe('wrong_answer');
    });

    it('should detect compile_error from Judge0 status', () => {
      const exec = { status: { id: 6 }, compile_output: Buffer.from('Error').toString('base64') };
      const testCase = { expectedOutput: "Any" };
      
      const result = grader.evaluateTestCase(exec, testCase);
      expect(result.verdict).toBe('compile_error');
    });
  });

  describe('calculateFinalVerdict', () => {
    it('should return accepted if all test cases passed', () => {
      const results = [
        { verdict: 'accepted', time: 0.1, memory: 100 },
        { verdict: 'accepted', time: 0.2, memory: 200 }
      ];
      const final = grader.calculateFinalVerdict(results, 2);
      expect(final.finalVerdict).toBe('accepted');
      expect(final.passedCount).toBe(2);
    });

    it('should prioritize compile_error over others', () => {
      const results = [
        { verdict: 'wrong_answer', time: 0.1, memory: 100 },
        { verdict: 'compile_error', time: 0, memory: 0 }
      ];
      const final = grader.calculateFinalVerdict(results, 2);
      expect(final.finalVerdict).toBe('compile_error');
    });
  });
});
