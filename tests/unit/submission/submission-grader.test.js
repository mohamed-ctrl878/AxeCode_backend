import { describe, it, expect } from 'vitest';
const StrapiMock = require('../../helpers/strapi-mock');
const strapiMock = new StrapiMock();

const graderFactory = require('../../../src/api/submission/services/submission-grader');
const grader = graderFactory({ strapi: strapiMock });

// Helper: encode string to base64 (like Judge0 returns)
function b64(str) {
  return Buffer.from(str).toString('base64');
}

describe('SubmissionGrader Service', () => {
  // ============================================================
  // TEST SUITE: evaluateTestCase — Status ID Handling
  // ============================================================
  describe('evaluateTestCase — Status IDs', () => {
    it('should return accepted (status 3) when output matches expected integer', () => {
      const exec = {
        status: { id: 3, description: 'Accepted' },
        stdout: b64('42'),
        time: '0.05',
        memory: '1024'
      };
      const testCase = { id: 1, expectedOutput: 42 };
      const result = grader.evaluateTestCase(exec, testCase);
      expect(result.verdict).toBe('accepted');
      expect(result.actualOutput).toBe(42);
    });

    it('should return wrong_answer (status 4)', () => {
      const exec = {
        status: { id: 4, description: 'Wrong Answer' },
        stdout: b64('wrong'),
        time: '0.1',
        memory: '2048'
      };
      const testCase = { id: 1, expectedOutput: 'correct' };
      const result = grader.evaluateTestCase(exec, testCase);
      expect(result.verdict).toBe('wrong_answer');
    });

    it('should return time_limit_exceeded (status 5)', () => {
      const exec = {
        status: { id: 5, description: 'Time Limit Exceeded' },
        stdout: b64(''),
        time: '5.0',
        memory: '2048'
      };
      const testCase = { id: 1, expectedOutput: 42 };
      const result = grader.evaluateTestCase(exec, testCase);
      expect(result.verdict).toBe('time_limit_exceeded');
    });

    it('should return compile_error (status 6)', () => {
      const exec = {
        status: { id: 6, description: 'Compilation Error' },
        stdout: null,
        compile_output: b64('error: missing semicolon'),
        time: '0',
        memory: '0'
      };
      const testCase = { id: 1, expectedOutput: 42 };
      const result = grader.evaluateTestCase(exec, testCase);
      expect(result.verdict).toBe('compile_error');
      expect(result.error).toBe('error: missing semicolon');
    });

    it('should return runtime_error (status 7+)', () => {
      for (const statusId of [7, 8, 9, 10, 11, 12, 13]) {
        const exec = {
          status: { id: statusId, description: 'Runtime Error' },
          stdout: b64(''),
          stderr: b64('Segfault'),
          time: '0',
          memory: '0'
        };
        const testCase = { id: 1, expectedOutput: 42 };
        const result = grader.evaluateTestCase(exec, testCase);
        expect(result.verdict).toBe('runtime_error');
      }
    });

    it('should return runtime_error when stdout is empty on status 3 (parse failure)', () => {
      const exec = {
        status: { id: 3, description: 'Accepted' },
        stdout: b64(''),
        time: '0',
        memory: '0'
      };
      const testCase = { id: 1, expectedOutput: 42 };
      const result = grader.evaluateTestCase(exec, testCase);
      expect(result.verdict).toBe('runtime_error');
    });
  });

  // ============================================================
  // TEST SUITE: evaluateTestCase — Delimiter Parsing
  // ============================================================
  describe('evaluateTestCase — Delimiter Parsing', () => {
    it('should split user stdout from result using delimiter', () => {
      const userOutput = 'Debug: processing...';
      const resultValue = '42';
      const delimiter = 'AXECODE_test123';
      const fullStdout = `${userOutput}\n${delimiter}\n${resultValue}`;

      const exec = {
        status: { id: 3 },
        stdout: b64(fullStdout),
        time: '0.1',
        memory: '1024'
      };
      const testCase = { id: 1, expectedOutput: 42 };
      const result = grader.evaluateTestCase(exec, testCase, delimiter);
      expect(result.verdict).toBe('accepted');
      expect(result.actualOutput).toBe(42);
      expect(result.userStdout).toBe('Debug: processing...');
    });

    it('should handle multiple print statements before delimiter', () => {
      const delimiter = 'AXECODE_multi';
      const fullStdout = `line1\nline2\nline3\n${delimiter}\n99`;

      const exec = {
        status: { id: 3 },
        stdout: b64(fullStdout),
        time: '0.1',
        memory: '1024'
      };
      const testCase = { id: 1, expectedOutput: 99 };
      const result = grader.evaluateTestCase(exec, testCase, delimiter);
      expect(result.verdict).toBe('accepted');
      expect(result.actualOutput).toBe(99);
      expect(result.userStdout).toContain('line1');
      expect(result.userStdout).toContain('line3');
    });

    it('should handle print statements AFTER delimiter (intermediate logs)', () => {
      const delimiter = 'AXECODE_after';
      const fullStdout = `user_debug\n${delimiter}\nintermediate_log\n"final_answer"`;

      const exec = {
        status: { id: 3 },
        stdout: b64(fullStdout),
        time: '0.1',
        memory: '1024'
      };
      const testCase = { id: 1, expectedOutput: 'final_answer' };
      const result = grader.evaluateTestCase(exec, testCase, delimiter);
      expect(result.verdict).toBe('accepted');
      expect(result.actualOutput).toBe('final_answer');
    });

    it('should work without a delimiter', () => {
      const exec = {
        status: { id: 3 },
        stdout: b64('"hello"'),
        time: '0.1',
        memory: '1024'
      };
      const testCase = { id: 1, expectedOutput: 'hello' };
      const result = grader.evaluateTestCase(exec, testCase);
      expect(result.verdict).toBe('accepted');
    });
  });

  // ============================================================
  // TEST SUITE: evaluateTestCase — Data Type Comparisons
  // ============================================================
  describe('evaluateTestCase — Data Type Comparisons', () => {
    it('should compare integer results correctly', () => {
      const exec = { status: { id: 3 }, stdout: b64('42'), time: '0.1', memory: '1024' };
      expect(grader.evaluateTestCase(exec, { id: 1, expectedOutput: 42 }).verdict).toBe('accepted');
      expect(grader.evaluateTestCase(exec, { id: 1, expectedOutput: 43 }).verdict).toBe('wrong_answer');
    });

    it('should compare string results correctly', () => {
      const exec = { status: { id: 3 }, stdout: b64('"hello"'), time: '0.1', memory: '1024' };
      expect(grader.evaluateTestCase(exec, { id: 1, expectedOutput: 'hello' }).verdict).toBe('accepted');
      expect(grader.evaluateTestCase(exec, { id: 1, expectedOutput: 'world' }).verdict).toBe('wrong_answer');
    });

    it('should compare array results correctly', () => {
      const exec = { status: { id: 3 }, stdout: b64('[1,2,3]'), time: '0.1', memory: '1024' };
      expect(grader.evaluateTestCase(exec, { id: 1, expectedOutput: [1, 2, 3] }).verdict).toBe('accepted');
      expect(grader.evaluateTestCase(exec, { id: 1, expectedOutput: [3, 2, 1] }).verdict).toBe('wrong_answer');
    });

    it('should compare boolean results correctly', () => {
      const exec = { status: { id: 3 }, stdout: b64('true'), time: '0.1', memory: '1024' };
      expect(grader.evaluateTestCase(exec, { id: 1, expectedOutput: true }).verdict).toBe('accepted');
      expect(grader.evaluateTestCase(exec, { id: 1, expectedOutput: false }).verdict).toBe('wrong_answer');
    });

    it('should compare null result correctly', () => {
      const exec = { status: { id: 3 }, stdout: b64('null'), time: '0.1', memory: '1024' };
      expect(grader.evaluateTestCase(exec, { id: 1, expectedOutput: null }).verdict).toBe('accepted');
    });

    it('should compare nested array results correctly', () => {
      const exec = { status: { id: 3 }, stdout: b64('[[1,2],[3,4]]'), time: '0.1', memory: '1024' };
      expect(grader.evaluateTestCase(exec, { id: 1, expectedOutput: [[1, 2], [3, 4]] }).verdict).toBe('accepted');
    });

    it('should handle expectedOutput inside data wrapper', () => {
      const exec = { status: { id: 3 }, stdout: b64('42'), time: '0.1', memory: '1024' };
      const testCase = { id: 1, expectedOutput: { data: 42 } };
      expect(grader.evaluateTestCase(exec, testCase).verdict).toBe('accepted');
    });
  });

  // ============================================================
  // TEST SUITE: evaluateTestCase — Edge Cases
  // ============================================================
  describe('evaluateTestCase — Edge Cases', () => {
    it('should handle null stdout gracefully', () => {
      const exec = { status: { id: 3 }, stdout: null, time: '0.1', memory: '1024' };
      const testCase = { id: 1, expectedOutput: 42 };
      const result = grader.evaluateTestCase(exec, testCase);
      expect(result.verdict).toBe('runtime_error');
    });

    it('should handle undefined stdout gracefully', () => {
      const exec = { status: { id: 3 }, time: '0.1', memory: '1024' };
      const testCase = { id: 1, expectedOutput: 42 };
      const result = grader.evaluateTestCase(exec, testCase);
      expect(result.verdict).toBe('runtime_error');
    });

    it('should return time in milliseconds', () => {
      const exec = { status: { id: 3 }, stdout: b64('42'), time: '0.256', memory: '4096' };
      const testCase = { id: 1, expectedOutput: 42 };
      const result = grader.evaluateTestCase(exec, testCase);
      expect(result.time).toBeCloseTo(256, 0);
    });

    it('should return memory in KB', () => {
      const exec = { status: { id: 3 }, stdout: b64('42'), time: '0.1', memory: '4096' };
      const testCase = { id: 1, expectedOutput: 42 };
      const result = grader.evaluateTestCase(exec, testCase);
      expect(result.memory).toBe(4096);
    });

    it('should handle stderr information', () => {
      const exec = {
        status: { id: 11 },
        stdout: b64(''),
        stderr: b64('NameError: name "x" is not defined'),
        time: '0',
        memory: '0'
      };
      const testCase = { id: 1, expectedOutput: 42 };
      const result = grader.evaluateTestCase(exec, testCase);
      expect(result.verdict).toBe('runtime_error');
      expect(result.error).toContain('NameError');
    });

    it('should handle very large user stdout by truncating', () => {
      const delimiter = 'AXECODE_trunc';
      // Create 100KB of user output
      const bigOutput = 'x'.repeat(100 * 1024);
      const fullStdout = `${bigOutput}\n${delimiter}\n42`;

      const exec = { status: { id: 3 }, stdout: b64(fullStdout), time: '0.1', memory: '1024' };
      const testCase = { id: 1, expectedOutput: 42 };
      const result = grader.evaluateTestCase(exec, testCase, delimiter);
      expect(result.verdict).toBe('accepted');
      expect(result.userStdout).toContain('[Output Truncated');
    });
  });

  // ============================================================
  // TEST SUITE: calculateFinalVerdict
  // ============================================================
  describe('calculateFinalVerdict', () => {
    it('should return accepted when all tests pass', () => {
      const results = [
        { verdict: 'accepted', time: 100, memory: 1024 },
        { verdict: 'accepted', time: 200, memory: 2048 },
        { verdict: 'accepted', time: 150, memory: 1500 }
      ];
      const final = grader.calculateFinalVerdict(results, 3);
      expect(final.finalVerdict).toBe('accepted');
      expect(final.passedCount).toBe(3);
      expect(final.totalTestCases).toBe(3);
    });

    it('should prioritize compile_error over all others', () => {
      const results = [
        { verdict: 'accepted', time: 100, memory: 1024 },
        { verdict: 'compile_error', time: 0, memory: 0 },
        { verdict: 'wrong_answer', time: 100, memory: 1024 }
      ];
      const final = grader.calculateFinalVerdict(results, 3);
      expect(final.finalVerdict).toBe('compile_error');
    });

    it('should prioritize runtime_error over wrong_answer', () => {
      const results = [
        { verdict: 'wrong_answer', time: 100, memory: 1024 },
        { verdict: 'runtime_error', time: 0, memory: 0 }
      ];
      const final = grader.calculateFinalVerdict(results, 2);
      expect(final.finalVerdict).toBe('runtime_error');
    });

    it('should prioritize time_limit_exceeded over wrong_answer', () => {
      const results = [
        { verdict: 'wrong_answer', time: 100, memory: 1024 },
        { verdict: 'time_limit_exceeded', time: 5000, memory: 0 }
      ];
      const final = grader.calculateFinalVerdict(results, 2);
      expect(final.finalVerdict).toBe('time_limit_exceeded');
    });

    it('should sum execution times across all tests', () => {
      const results = [
        { verdict: 'accepted', time: 100, memory: 1024 },
        { verdict: 'accepted', time: 200, memory: 2048 }
      ];
      const final = grader.calculateFinalVerdict(results, 2);
      expect(final.executionTime).toBe(300);
    });

    it('should take max memory across all tests', () => {
      const results = [
        { verdict: 'accepted', time: 100, memory: 1024 },
        { verdict: 'accepted', time: 200, memory: 4096 },
        { verdict: 'accepted', time: 150, memory: 2048 }
      ];
      const final = grader.calculateFinalVerdict(results, 3);
      expect(final.memoryUsed).toBe(4096);
    });

    it('should count only accepted verdicts as passed', () => {
      const results = [
        { verdict: 'accepted', time: 100, memory: 1024 },
        { verdict: 'wrong_answer', time: 100, memory: 1024 },
        { verdict: 'accepted', time: 100, memory: 1024 }
      ];
      const final = grader.calculateFinalVerdict(results, 3);
      expect(final.passedCount).toBe(2);
    });

    it('should handle empty results array', () => {
      const final = grader.calculateFinalVerdict([], 0);
      expect(final.finalVerdict).toBe('accepted');
      expect(final.passedCount).toBe(0);
      expect(final.executionTime).toBe(0);
    });

    it('should handle single test case failure', () => {
      const results = [{ verdict: 'wrong_answer', time: 100, memory: 1024 }];
      const final = grader.calculateFinalVerdict(results, 1);
      expect(final.finalVerdict).toBe('wrong_answer');
      expect(final.passedCount).toBe(0);
    });
  });
});
