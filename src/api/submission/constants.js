'use strict';

/**
 * Constants for Submission API
 */

const LANGUAGE_MAP = {
  'javascript': 63, // Node.js 12.14.0
  'python': 71,   // Python 3.8.1
  'java': 62,     // Java (OpenJDK 13.0.1)
  'cpp': 54,      // C++ (GCC 9.2.0)
};

const SUBMISSION_POPULATE = {
  problem: {
    populate: {
      test_cases: true,
      code_templates: true
    }
  },
  user: {
    fields: ['id', 'username', 'email']
  }
};

module.exports = {
  LANGUAGE_MAP,
  SUBMISSION_POPULATE,
};
