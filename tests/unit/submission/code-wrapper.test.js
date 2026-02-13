import { describe, it, expect } from 'vitest';
const StrapiMock = require('../../helpers/strapi-mock');
const strapiMock = new StrapiMock();

const wrapperFactory = require('../../../src/api/submission/services/code-wrapper');
const wrapper = wrapperFactory({ strapi: strapiMock });

describe('CodeWrapper Service', () => {
  describe('wrap', () => {
    it('should inject user code into template placeholder', () => {
      const userCode = 'return a + b;';
      const template = { wrapperCode: 'function main() { {USER_CODE} }' };
      
      const result = wrapper.wrap(userCode, template);
      expect(result).toBe('function main() { return a + b; }');
    });

    it('should throw error if template is missing wrapperCode', () => {
      expect(() => wrapper.wrap('code', {})).toThrow();
    });
  });

  describe('prepareStdin', () => {
    it('should format simple parameters as newline-separated strings', () => {
      const testCase = { input: { a: 5, b: 10 } };
      const params = [{ name: 'a' }, { name: 'b' }];
      
      const result = wrapper.prepareStdin(testCase, params);
      expect(result).toBe('5\n10');
    });

    it('should handle complex JSON objects in parameters', () => {
      const testCase = { input: { data: [1, 2, 3] } };
      const params = [{ name: 'data' }];
      
      const result = wrapper.prepareStdin(testCase, params);
      expect(result).toBe('[1,2,3]');
    });
  });
});
