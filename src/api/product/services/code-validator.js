'use strict';

/**
 * Code Validator Service
 * Handles code validation, security checks, and sanitization
 */

// Security configuration constants
const SECURITY_CONFIG = {
  MAX_CODE_SIZE: 10000, // characters
  MAX_EXECUTION_TIME: 10000, // milliseconds
  MAX_MEMORY_USAGE: 100 * 1024 * 1024, // 100 MB
  MAX_OUTPUT_SIZE: 1024 * 1024, // 1 MB
  MAX_TEST_CASES: 50,
  ALLOWED_LIBRARIES: [
    "iostream",
    "vector",
    "string",
    "algorithm",
    "cmath",
    "chrono",
    "queue",
    "stack",
    "map",
    "set",
    "unordered_map",
    "unordered_set",
    "bits/stdc++.h",
  ],
  FORBIDDEN_KEYWORDS: [
    "system", "exec", "popen", "fork", "kill", "signal", "mmap",
    "shmget", "shmat", "shmdt", "shmctl", "socket", "bind", "listen",
    "accept", "connect", "open", "creat", "unlink", "remove", "rename",
    "chmod", "chown", "mkdir", "rmdir", "link", "symlink", "mount",
    "umount", "reboot", "shutdown", "halt", "network", "http", "curl",
    "wget", "ftp", "ssh", "database", "mysql", "postgresql", "sqlite",
    "file", "directory", "process", "thread", "pipe", "semaphore",
    "mutex", "condition_variable", "atomic", "memory_order", "volatile",
    "register",
  ],
  SUPPORTED_LANGUAGES: ['cpp'],
  SUPPORTED_RETURN_TYPES: [
    'int', 'double', 'bool', 'string', 
    'vector<int>', 'vector<double>', 'vector<string>', 'vector<bool>',
    'set<int>', 'map<string, int>', 'TreeNode*', 'ListNode*'
  ],
  SUPPORTED_INPUT_TYPES: [
    'int', 'double', 'bool', 'string', 'char',
    'vector<int>', 'vector<double>', 'vector<string>', 'vector<bool>',
    'TreeNode*', 'ListNode*'
  ]
};

class CodeValidator {
  constructor() {
    this.config = SECURITY_CONFIG;
  }

  /**
   * Validate request data structure
   */
  validateRequestData(requestData) {
    const errors = [];

    // Check required fields
    if (!requestData.language) {
      errors.push('Language is required');
    }

    if (!requestData.code || typeof requestData.code !== 'string') {
      errors.push('Code is required and must be a string');
    }

    if (!requestData.functionName || typeof requestData.functionName !== 'string') {
      errors.push('Function name is required and must be a string');
    }

    if (!requestData.functionReturnType) {
      errors.push('Function return type is required');
    }

    if (!Array.isArray(requestData.testCases)) {
      errors.push('Test cases must be an array');
    }

    if (!Array.isArray(requestData.expected)) {
      errors.push('Expected results must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate language support
   */
  validateLanguage(language) {
    if (!this.config.SUPPORTED_LANGUAGES.includes(language)) {
      return {
        isValid: false,
        error: `Unsupported language: ${language}. Supported languages: ${this.config.SUPPORTED_LANGUAGES.join(', ')}`
      };
    }
    return { isValid: true };
  }

  /**
   * Validate code content and security
   */
  validateCode(code) {
    const errors = [];

    // Check code size
    if (!code || typeof code !== 'string') {
      errors.push('Code must be a non-empty string');
      return { isValid: false, errors };
    }

    if (code.trim() === '') {
      errors.push('Code cannot be empty');
    }

    if (code.length > this.config.MAX_CODE_SIZE) {
      errors.push(`Code size exceeds limit of ${this.config.MAX_CODE_SIZE} characters`);
    }

    // Security checks - forbidden keywords
    const codeLower = code.toLowerCase();
    for (const keyword of this.config.FORBIDDEN_KEYWORDS) {
      if (codeLower.includes(keyword.toLowerCase())) {
        errors.push(`Forbidden keyword detected: ${keyword}`);
      }
    }

    // Check for common malicious patterns
    const maliciousPatterns = [
      /system\s*\(/i,
      /exec\s*\(/i,
      /popen\s*\(/i,
      /#include\s*<\s*windows\.h\s*>/i,
      /#include\s*<\s*unistd\.h\s*>/i,
      /fork\s*\(/i,
      /getuid\s*\(/i,
      /setuid\s*\(/i,
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(code)) {
        errors.push(`Potentially dangerous code pattern detected`);
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate function metadata
   */
  validateFunctionMetadata(functionName, functionReturnType) {
    const errors = [];

    // Validate function name
    if (!functionName || typeof functionName !== 'string') {
      errors.push('Function name is required and must be a string');
    } else {
      // Check function name format
      const functionNamePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      if (!functionNamePattern.test(functionName)) {
        errors.push('Function name contains invalid characters');
      }
    }

    // Validate return type
    if (!functionReturnType) {
      errors.push('Function return type is required');
    } else if (!this.config.SUPPORTED_RETURN_TYPES.includes(functionReturnType)) {
      errors.push(`Unsupported return type: ${functionReturnType}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate test cases
   */
  validateTestCases(testCases, expected) {
    const errors = [];

    if (!Array.isArray(testCases)) {
      errors.push('Test cases must be an array');
      return { isValid: false, errors };
    }

    if (!Array.isArray(expected)) {
      errors.push('Expected results must be an array');
      return { isValid: false, errors };
    }

    // Check test case count
    if (testCases.length === 0) {
      errors.push('At least one test case is required');
    }

    if (testCases.length > this.config.MAX_TEST_CASES) {
      errors.push(`Number of test cases exceeds limit of ${this.config.MAX_TEST_CASES}`);
    }

    // Check expected results count matches test cases
    if (testCases.length !== expected.length) {
      errors.push('Number of expected results must match number of test cases');
    }

    // Validate individual test cases
    testCases.forEach((testCase, index) => {
      if (!testCase || typeof testCase !== 'object') {
        errors.push(`Test case ${index + 1} must be an object`);
        return;
      }

      if (!testCase.id) {
        errors.push(`Test case ${index + 1} must have an id`);
      }

      if (!Array.isArray(testCase.inputs)) {
        errors.push(`Test case ${index + 1} inputs must be an array`);
      }

      if (!Array.isArray(testCase.inputTypes)) {
        errors.push(`Test case ${index + 1} inputTypes must be an array`);
      }

      if (testCase.inputs && testCase.inputTypes) {
        if (testCase.inputs.length !== testCase.inputTypes.length) {
          errors.push(`Test case ${index + 1}: number of inputs must match number of input types`);
        }

        // Validate input types
        testCase.inputTypes.forEach((inputType, inputIndex) => {
          if (!this.config.SUPPORTED_INPUT_TYPES.includes(inputType)) {
            errors.push(`Test case ${index + 1}, input ${inputIndex + 1}: unsupported input type "${inputType}"`);
          }
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate complete request
   */
  validateRequest(requestData) {
    const validation = {
      isValid: true,
      errors: []
    };

    // Validate request structure
    const structureValidation = this.validateRequestData(requestData);
    if (!structureValidation.isValid) {
      validation.errors.push(...structureValidation.errors);
      validation.isValid = false;
    }

    // If structure is invalid, stop here
    if (!structureValidation.isValid) {
      return validation;
    }

    // Validate language
    const languageValidation = this.validateLanguage(requestData.language);
    if (!languageValidation.isValid) {
      validation.errors.push(languageValidation.error);
      validation.isValid = false;
    }

    // Validate code
    const codeValidation = this.validateCode(requestData.code);
    if (!codeValidation.isValid) {
      validation.errors.push(...codeValidation.errors);
      validation.isValid = false;
    }

    // Validate function metadata
    const functionValidation = this.validateFunctionMetadata(
      requestData.functionName,
      requestData.functionReturnType
    );
    if (!functionValidation.isValid) {
      validation.errors.push(...functionValidation.errors);
      validation.isValid = false;
    }

    // Validate test cases
    const testCasesValidation = this.validateTestCases(
      requestData.testCases,
      requestData.expected
    );
    if (!testCasesValidation.isValid) {
      validation.errors.push(...testCasesValidation.errors);
      validation.isValid = false;
    }

    return validation;
  }

  /**
   * Sanitize code input
   */
  sanitizeCode(code) {
    if (!code || typeof code !== 'string') {
      return '';
    }

    // Remove any non-printable characters except newlines and tabs
    let sanitized = code.replace(/[^\x20-\x7E\n\t\r]/g, '');
    
    // Remove any Windows-specific line endings and normalize
    sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Limit line length to prevent excessive memory usage
    const lines = sanitized.split('\n');
    const maxLineLength = 200;
    const sanitizedLines = lines.map(line => {
      if (line.length > maxLineLength) {
        return line.substring(0, maxLineLength) + '...';
      }
      return line;
    });

    return sanitizedLines.join('\n');
  }

  /**
   * Get security configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Check if output size is within limits
   */
  validateOutputSize(output) {
    if (!output) return { isValid: true };

    const size = typeof output === 'string' ? output.length : JSON.stringify(output).length;
    
    if (size > this.config.MAX_OUTPUT_SIZE) {
      return {
        isValid: false,
        error: `Output size (${size} bytes) exceeds limit of ${this.config.MAX_OUTPUT_SIZE} bytes`
      };
    }

    return { isValid: true };
  }
}

module.exports = () => {
  return new CodeValidator();
};