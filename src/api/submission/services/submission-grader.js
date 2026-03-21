'use strict';

/**
 * SubmissionGrader Service
 * Responsible for evaluating Judge0 outputs and determining the final verdict.
 */

module.exports = ({ strapi }) => ({
  /**
   * Evaluate a single test case result
   */
  evaluateTestCase(execution, testCase, delimiter = '') {
    const statusId = execution.status?.id;
    const stdout = execution.stdout ? Buffer.from(execution.stdout, 'base64').toString('utf8').trim() : '';
    const stderr = execution.stderr ? Buffer.from(execution.stderr, 'base64').toString('utf8').trim() : '';
    const compileOut = execution.compile_output ? Buffer.from(execution.compile_output, 'base64').toString('utf8').trim() : '';

    let verdict = 'wrong_answer';
    let actualOutput = null;
    let userStdout = stdout;

    if (statusId === 3) { // Accepted in Judge0
      try {
        let finalOutputToParse = stdout;

        // If a delimiter is provided and found in stdout, split it
        if (delimiter && stdout.includes(delimiter)) {
          const parts = stdout.split(delimiter);
          userStdout = parts[0].trim();

          // Everything after the delimiter (parts[1..n]) contains interim logs and the final numeric/json result
          const afterDelimiter = parts.slice(1).join(delimiter).trim();
          const lines = afterDelimiter.split('\n').map(l => l.trim()).filter(l => l.length > 0);

          if (lines.length > 0) {
            // The very last printed line is our JSON-serialized return value
            finalOutputToParse = lines[lines.length - 1];

            // Any lines between the delimiter and the final result are user logs
            const intermediateLogs = lines.slice(0, -1).join('\n');
            if (intermediateLogs) {
              userStdout = (userStdout ? userStdout + '\n' : '') + intermediateLogs;
            }
          }
        }

        // --- Safety Truncation for DB & UI ---
        const MAX_LOG_SIZE = 64 * 1024; // 64KB
        if (userStdout.length > MAX_LOG_SIZE) {
          userStdout = userStdout.substring(0, MAX_LOG_SIZE) + "\n\n... [Output Truncated for Performance]";
        }

        actualOutput = JSON.parse(finalOutputToParse);
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
      userStdout,
      stdout, // Keep entire raw stdout for debugging if needed
      expectedOutput: testCase.expectedOutput?.data ?? testCase.expectedOutput,
      time: (parseFloat(execution.time) * 1000) || 0,
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
