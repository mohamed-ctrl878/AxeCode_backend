'use strict';

/**
 * SubmissionGrader Service
 * Responsible for evaluating Judge0 outputs and determining the final verdict.
 */

module.exports = ({ strapi }) => ({
  /**
   * Evaluate a single test case result
   */
  evaluateTestCase(execution, testCase) {
    const statusId = execution.status?.id;
    const stdout = execution.stdout ? Buffer.from(execution.stdout, 'base64').toString('utf8').trim() : '';
    const stderr = execution.stderr ? Buffer.from(execution.stderr, 'base64').toString('utf8').trim() : '';
    const compileOut = execution.compile_output ? Buffer.from(execution.compile_output, 'base64').toString('utf8').trim() : '';

    let verdict = 'wrong_answer';
    let actualOutput = null;

    if (statusId === 3) { // Accepted in Judge0
      try {
        actualOutput = JSON.parse(stdout);
        const expected = testCase.expectedOutput?.data ?? testCase.expectedOutput;
        
        if (JSON.stringify(actualOutput) === JSON.stringify(expected)) {
          verdict = 'accepted';
        }
      } catch (e) {
        verdict = 'runtime_error';
      }
    } 
    else if (statusId === 4) verdict = 'wrong_answer';
    else if (statusId === 5) verdict = 'time_limit_exceeded';
    else if (statusId === 6) verdict = 'compile_error';
    else if (statusId >= 7) verdict = 'runtime_error';

    return {
      testCaseId: testCase.id || testCase.documentId,
      verdict,
      actualOutput,
      stdout,
      expectedOutput: testCase.expectedOutput?.data ?? testCase.expectedOutput,
      time: parseFloat(execution.time) || 0,
      memory: parseInt(execution.memory) || 0,
      error: stderr || compileOut
    };
  },

  /**
   * Calculate final submission statistics and verdict
   */
  calculateFinalVerdict(results, totalTestCases) {
    const passedCount = results.filter(r => r.verdict === 'accepted').length;
    
    // Final verdict priority logic (first non-accepted encountered)
    const priority = ['compile_error', 'runtime_error', 'time_limit_exceeded', 'wrong_answer', 'accepted'];
    let finalVerdict = 'accepted';
    
    for (const p of priority) {
        if (results.some(r => r.verdict === p)) {
            finalVerdict = p;
            break;
        }
    }

    return {
      finalVerdict,
      passedCount,
      totalTestCases,
      executionTime: results.reduce((acc, curr) => acc + curr.time, 0),
      memoryUsed: results.length > 0 ? Math.max(...results.map(r => r.memory)) : 0
    };
  }
});
