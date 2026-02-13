'use strict';

const axios = require('axios');
const { LANGUAGE_MAP } = require('../constants');

/**
 * Service to communicate with Judge0 API
 */

module.exports = ({ strapi }) => ({
  getBaseUrl() {
    return process.env.JUDGE0_API_URL || 'http://localhost:2358';
  },

  async getLanguages() {
    try {
      const response = await axios.get(`${this.getBaseUrl()}/languages`);
      return response.data;
    } catch (error) {
      strapi.log.error(`[Judge0] Error (getLanguages): ${error.message}`);
      return [];
    }
  },

  async executeCode(languageId, sourceCode, stdin = '') {
    try {
      const payload = {
        language_id: languageId,
        source_code: Buffer.from(sourceCode).toString('base64'),
        stdin: Buffer.from(stdin).toString('base64'),
      };

      const response = await axios.post(`${this.getBaseUrl()}/submissions?wait=true&base64_encoded=true`, payload);
      return response.data;
    } catch (error) {
      strapi.log.error(`[Judge0] Error (executeCode): ${error.message}`);
      throw new Error('Code execution engine is currently unavailable');
    }
  },

  async executeBatch(submissions) {
    try {
      const payload = {
        submissions: submissions.map(s => ({
          language_id: s.languageId,
          source_code: Buffer.from(s.sourceCode).toString('base64'),
          stdin: Buffer.from(s.stdin || '').toString('base64'),
        }))
      };

      const response = await axios.post(`${this.getBaseUrl()}/submissions/batch?base64_encoded=true`, payload);
      const tokens = response.data.map(r => r.token);
      
      return await this.pollBatchResults(tokens);
    } catch (error) {
      strapi.log.error(`[Judge0] Error (executeBatch): ${error.message}`);
      throw new Error('Batch execution failed');
    }
  },

  async pollBatchResults(tokens) {
    const maxRetries = 10;
    let retries = 0;
    
    while (retries < maxRetries) {
      const response = await axios.get(`${this.getBaseUrl()}/submissions/batch?tokens=${tokens.join(',')}&base64_encoded=true`);
      const results = response.data.submissions;
      
      const allDone = results.every(r => r.status.id > 2); // 1: In Queue, 2: Processing
      if (allDone) return results;
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries++;
    }
    throw new Error('Batch execution timeout');
  },

  // Map our enumeration to Judge0 IDs (OCP: Uses external map)
  getLanguageId(language) {
    return LANGUAGE_MAP[language.toLowerCase()];
  }
});
