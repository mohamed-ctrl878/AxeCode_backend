'use strict';

/**
 * CodeWrapper Service
 * Responsible for preparing the final source code by injecting user code into templates.
 */

module.exports = ({ strapi }) => ({
  /**
   * Inject user code into the language-specific wrapper
   */
  wrap(userCode, template) {
    if (!template || !template.wrapperCode) {
      throw new Error(`Wrapper code missing for language ${template?.language}`);
    }

    // Replace the placeholder with actual user code
    // Standard placeholder is {USER_CODE}
    return template.wrapperCode.replace('{USER_CODE}', userCode);
  },

  /**
   * Prepare STDIN for test cases based on function parameters
   */
  prepareStdin(testCase, functionParams) {
    if (!functionParams || !Array.isArray(functionParams)) return '';
    
    return functionParams
      .map(param => {
        const val = testCase.input?.data?.[param.name] ?? testCase.input?.[param.name];
        // Ensure values are serialized for Judge0 consumption if needed
        return JSON.stringify(val !== undefined ? val : null);
      })
      .join('\n');
  }
});
