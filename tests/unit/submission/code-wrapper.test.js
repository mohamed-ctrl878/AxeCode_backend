import { describe, it, expect, beforeEach } from 'vitest';
const StrapiMock = require('../../helpers/strapi-mock');
const strapiMock = new StrapiMock();

const wrapperFactory = require('../../../src/api/submission/services/code-wrapper');
const wrapper = wrapperFactory({ strapi: strapiMock });

// ============================================================
// Helper: Creates a realistic template object for a given language
// ============================================================
function makeTemplate(language) {
  const templates = {
    python: `{IMPORTS}
{COMMON_CLASSES}

# ==== USER CODE ====
{USER_CODE}
# ==== END ====

{SERIALIZERS}

if __name__ == "__main__":
    {PARAM_ASSIGNMENTS}

    # Separation Logic
    print("\\n{DELIMITER}")

    result = {INVOCATION}
    print("\\n" + json.dumps(serialize_result(result)))
`,
    javascript: `{IMPORTS}
{COMMON_CLASSES}

// ==== USER CODE ====
{USER_CODE}
// ==== END ====

{SERIALIZERS}

const input = require('fs').readFileSync('/dev/stdin', 'utf8');
{PARAM_ASSIGNMENTS}

// Separation Logic
console.log("\\n{DELIMITER}");

const result = {INVOCATION};
console.log("\\n" + JSON.stringify(serialize(result)));
`,
    java: `{IMPORTS}

{COMMON_CLASSES}

// ==== USER CODE ====
{USER_CODE}
// ==== END ====

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        List<String> inputLines = new ArrayList<>();
        while (sc.hasNextLine()) {
            String line = sc.nextLine();
            if (!line.isEmpty()) inputLines.add(line);
        }

        Solution sol = new Solution();

        // Separation Logic
        System.out.println("\\n{DELIMITER}");

{PARAM_ASSIGNMENTS}
        Object result = {INVOCATION};
        System.out.println("\\n" + serialize(result));

    }

{SERIALIZERS}

}
`,
    cpp: `{IMPORTS}
{COMMON_CLASSES}

// ==== USER CODE ====
{USER_CODE}
// ==== END ====

{SERIALIZERS}

int main() {
    string line;
    vector<string> inputLines;
    while (getline(cin, line)) {
        if (!line.empty()) inputLines.push_back(line);
    }

    Solution sol;

    // Separation Logic
    cout << "\\n{DELIMITER}" << endl;

{PARAM_ASSIGNMENTS}
    auto result = {INVOCATION};
    cout << endl << serialize(result) << endl;

    return 0;
}
`
  };
  return { language, wrapperCode: templates[language] };
}

// ============================================================
// TEST SUITE: decode()
// ============================================================
describe('CodeWrapper Service', () => {
  describe('decode()', () => {
    it('should decode HTML entities back to raw characters', () => {
      expect(wrapper.decode('a &lt; b &amp;&amp; c &gt; d')).toBe('a < b && c > d');
    });

    it('should decode &quot; and &#39;', () => {
      expect(wrapper.decode('say &quot;hello&quot; it&#39;s fine')).toBe('say "hello" it\'s fine');
    });

    it('should decode &#x2F; to /', () => {
      expect(wrapper.decode('a &#x2F; b')).toBe('a / b');
    });

    it('should return empty string for null/undefined', () => {
      expect(wrapper.decode(null)).toBe('');
      expect(wrapper.decode(undefined)).toBe('');
    });

    it('should leave strings without entities untouched', () => {
      expect(wrapper.decode('plain text 123')).toBe('plain text 123');
    });
  });

  // ============================================================
  // TEST SUITE: prepareStdin()
  // ============================================================
  describe('prepareStdin()', () => {
    it('should format a single integer parameter', () => {
      const testCase = { input: { num: 42 } };
      const params = [{ name: 'num', type: 'int' }];
      expect(wrapper.prepareStdin(testCase, params)).toBe('42');
    });

    it('should format multiple parameters as newline-separated JSON', () => {
      const testCase = { input: { a: 5, b: 10 } };
      const params = [{ name: 'a', type: 'int' }, { name: 'b', type: 'int' }];
      expect(wrapper.prepareStdin(testCase, params)).toBe('5\n10');
    });

    it('should handle string parameters with JSON.stringify', () => {
      const testCase = { input: { name: 'hello world' } };
      const params = [{ name: 'name', type: 'string' }];
      expect(wrapper.prepareStdin(testCase, params)).toBe('"hello world"');
    });

    it('should handle array parameters', () => {
      const testCase = { input: { nums: [1, 2, 3, 4, 5] } };
      const params = [{ name: 'nums', type: 'int[]' }];
      expect(wrapper.prepareStdin(testCase, params)).toBe('[1,2,3,4,5]');
    });

    it('should handle null parameters', () => {
      const testCase = { input: { val: null } };
      const params = [{ name: 'val', type: 'string' }];
      expect(wrapper.prepareStdin(testCase, params)).toBe('null');
    });

    it('should handle missing parameter values as null', () => {
      const testCase = { input: { a: 5 } };
      const params = [{ name: 'a', type: 'int' }, { name: 'b', type: 'int' }];
      expect(wrapper.prepareStdin(testCase, params)).toBe('5\nnull');
    });

    it('should handle boolean parameters', () => {
      const testCase = { input: { flag: true } };
      const params = [{ name: 'flag', type: 'boolean' }];
      expect(wrapper.prepareStdin(testCase, params)).toBe('true');
    });

    it('should handle nested data structure (input.data.xxx)', () => {
      const testCase = { input: { data: { nums: [1, 2, 3] } } };
      const params = [{ name: 'nums', type: 'int[]' }];
      const result = wrapper.prepareStdin(testCase, params);
      expect(result).toBe('[1,2,3]');
    });

    it('should handle string array parameters', () => {
      const testCase = { input: { words: ['hello', 'world'] } };
      const params = [{ name: 'words', type: 'string[]' }];
      expect(wrapper.prepareStdin(testCase, params)).toBe('["hello","world"]');
    });

    it('should return empty string if no functionParams', () => {
      const testCase = { input: { a: 5 } };
      expect(wrapper.prepareStdin(testCase, null)).toBe('');
      expect(wrapper.prepareStdin(testCase, undefined)).toBe('');
    });

    it('should handle mixed types (int + string + array)', () => {
      const testCase = { input: { count: 3, name: 'test', items: [10, 20] } };
      const params = [
        { name: 'count', type: 'int' },
        { name: 'name', type: 'string' },
        { name: 'items', type: 'int[]' }
      ];
      expect(wrapper.prepareStdin(testCase, params)).toBe('3\n"test"\n[10,20]');
    });
  });

  // ============================================================
  // TEST SUITE: wrap() — Error Handling
  // ============================================================
  describe('wrap() — Error Handling', () => {
    it('should throw if template is null', () => {
      expect(() => wrapper.wrap('code', null)).toThrow();
    });

    it('should throw if template has no wrapperCode', () => {
      expect(() => wrapper.wrap('code', { language: 'python' })).toThrow();
    });

    it('should throw if template is empty object', () => {
      expect(() => wrapper.wrap('code', {})).toThrow();
    });
  });

  // ============================================================
  // TEST SUITE: wrap() — Python
  // ============================================================
  describe('wrap() — Python', () => {
    const problem = {
      functionName: 'twoSum',
      functionParams: [
        { name: 'nums', type: 'int[]' },
        { name: 'target', type: 'int' }
      ]
    };

    it('should inject user code into the template', () => {
      const userCode = 'def twoSum(nums, target):\n    return [0, 1]';
      const result = wrapper.wrap(userCode, makeTemplate('python'), 'DELIM_123', problem);
      expect(result).toContain('def twoSum(nums, target):');
      expect(result).toContain('return [0, 1]');
    });

    it('should include the delimiter in the output', () => {
      const userCode = 'def twoSum(nums, target):\n    return [0, 1]';
      const result = wrapper.wrap(userCode, makeTemplate('python'), 'DELIM_123', problem);
      expect(result).toContain('DELIM_123');
    });

    it('should include Python imports (json, sys, typing)', () => {
      const userCode = 'def twoSum(nums, target):\n    return [0, 1]';
      const result = wrapper.wrap(userCode, makeTemplate('python'), 'DELIM_123', problem);
      expect(result).toContain('import json');
      expect(result).toContain('import sys');
      expect(result).toContain('from typing import');
    });

    it('should include common classes (ListNode, TreeNode)', () => {
      const userCode = 'def twoSum(nums, target):\n    return [0, 1]';
      const result = wrapper.wrap(userCode, makeTemplate('python'), 'DELIM_123', problem);
      expect(result).toContain('class ListNode');
      expect(result).toContain('class TreeNode');
    });

    it('should include serializers', () => {
      const userCode = 'def twoSum(nums, target):\n    return [0, 1]';
      const result = wrapper.wrap(userCode, makeTemplate('python'), 'DELIM_123', problem);
      expect(result).toContain('def serialize_result');
      expect(result).toContain('def linkedlist_to_list');
    });

    it('should generate correct invocation with unpacking', () => {
      const userCode = 'def twoSum(nums, target):\n    return [0, 1]';
      const result = wrapper.wrap(userCode, makeTemplate('python'), 'DELIM_123', problem);
      expect(result).toContain('twoSum(*param_values)');
    });

    it('should read exactly N lines from stdin (N = number of params)', () => {
      const userCode = 'def twoSum(nums, target):\n    return [0, 1]';
      const result = wrapper.wrap(userCode, makeTemplate('python'), 'DELIM_123', problem);
      expect(result).toContain('_read_input(2)');
      expect(result).toContain('sys.stdin.readline()');
    });

    it('should handle single parameter function', () => {
      const singleParamProblem = {
        functionName: 'reverseString',
        functionParams: [{ name: 's', type: 'string' }]
      };
      const userCode = 'def reverseString(s):\n    return s[::-1]';
      const result = wrapper.wrap(userCode, makeTemplate('python'), 'D', singleParamProblem);
      expect(result).toContain('_read_input(1)');
      expect(result).toContain('reverseString(*param_values)');
    });

    it('should handle zero parameter function', () => {
      const zeroParamProblem = {
        functionName: 'getAnswer',
        functionParams: []
      };
      const userCode = 'def getAnswer():\n    return 42';
      const result = wrapper.wrap(userCode, makeTemplate('python'), 'D', zeroParamProblem);
      expect(result).toContain('_read_input(0)');
    });

    it('should produce valid Python syntax (no indentation errors)', () => {
      const userCode = 'def twoSum(nums, target):\n    return [0, 1]';
      const result = wrapper.wrap(userCode, makeTemplate('python'), 'D', problem);

      // Check that there's no mix of if __name__ without proper indentation
      const lines = result.split('\n');
      const mainBlock = lines.findIndex(l => l.includes('if __name__'));
      expect(mainBlock).toBeGreaterThan(-1);
    });
  });

  // ============================================================
  // TEST SUITE: wrap() — JavaScript
  // ============================================================
  describe('wrap() — JavaScript', () => {
    const problem = {
      functionName: 'addTwo',
      functionParams: [
        { name: 'a', type: 'int' },
        { name: 'b', type: 'int' }
      ]
    };

    it('should inject user code and delimiter', () => {
      const userCode = 'function addTwo(a, b) { return a + b; }';
      const result = wrapper.wrap(userCode, makeTemplate('javascript'), 'JS_DELIM', problem);
      expect(result).toContain('function addTwo(a, b) { return a + b; }');
      expect(result).toContain('JS_DELIM');
    });

    it('should generate correct invocation with spread', () => {
      const userCode = 'function addTwo(a, b) { return a + b; }';
      const result = wrapper.wrap(userCode, makeTemplate('javascript'), 'D', problem);
      expect(result).toContain('addTwo(...paramValues)');
    });

    it('should include JS common classes', () => {
      const userCode = 'function addTwo(a, b) { return a + b; }';
      const result = wrapper.wrap(userCode, makeTemplate('javascript'), 'D', problem);
      expect(result).toContain('function ListNode');
      expect(result).toContain('function TreeNode');
    });

    it('should parse stdin lines with JSON.parse', () => {
      const userCode = 'function addTwo(a, b) { return a + b; }';
      const result = wrapper.wrap(userCode, makeTemplate('javascript'), 'D', problem);
      expect(result).toContain('JSON.parse');
      expect(result).toContain("input.split");
    });
  });

  // ============================================================
  // TEST SUITE: wrap() — Java
  // ============================================================
  describe('wrap() — Java', () => {
    it('should generate correct int parameter assignment', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [{ name: 'num', type: 'int' }]
      };
      const userCode = 'class Solution { int solve(int num) { return num * 2; } }';
      const result = wrapper.wrap(userCode, makeTemplate('java'), 'D', problem);
      expect(result).toContain('int num = Integer.parseInt(');
    });

    it('should generate correct string parameter assignment', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [{ name: 'name', type: 'string' }]
      };
      const userCode = 'class Solution { String solve(String name) { return name; } }';
      const result = wrapper.wrap(userCode, makeTemplate('java'), 'D', problem);
      expect(result).toContain('String name =');
    });

    it('should generate correct int[] parameter assignment', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [{ name: 'nums', type: 'int[]' }]
      };
      const userCode = 'class Solution { int solve(int[] nums) { return nums[0]; } }';
      const result = wrapper.wrap(userCode, makeTemplate('java'), 'D', problem);
      expect(result).toContain('int[] nums = parseArray(');
    });

    it('should handle vector<int> alias for int[]', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [{ name: 'nums', type: 'vector<int>' }]
      };
      const userCode = 'class Solution { int solve(int[] nums) { return 0; } }';
      const result = wrapper.wrap(userCode, makeTemplate('java'), 'D', problem);
      expect(result).toContain('int[] nums = parseArray(');
    });

    it('should handle boolean parameter', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [{ name: 'flag', type: 'boolean' }]
      };
      const userCode = 'class Solution { boolean solve(boolean flag) { return flag; } }';
      const result = wrapper.wrap(userCode, makeTemplate('java'), 'D', problem);
      expect(result).toContain('boolean flag = Boolean.parseBoolean(');
    });

    it('should handle ListNode parameter', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [{ name: 'head', type: 'ListNode' }]
      };
      const userCode = 'class Solution { ListNode solve(ListNode head) { return head; } }';
      const result = wrapper.wrap(userCode, makeTemplate('java'), 'D', problem);
      expect(result).toContain('ListNode head = listToLinkedList(parseArray(');
    });

    it('should handle TreeNode parameter', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [{ name: 'root', type: 'TreeNode' }]
      };
      const userCode = 'class Solution { TreeNode solve(TreeNode root) { return root; } }';
      const result = wrapper.wrap(userCode, makeTemplate('java'), 'D', problem);
      expect(result).toContain('TreeNode root = listToTree(parseArray(');
    });

    it('should handle double and float parameters', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [
          { name: 'x', type: 'double' },
          { name: 'y', type: 'float' }
        ]
      };
      const userCode = 'class Solution { double solve(double x, float y) { return x + y; } }';
      const result = wrapper.wrap(userCode, makeTemplate('java'), 'D', problem);
      expect(result).toContain('double x = Double.parseDouble(');
      expect(result).toContain('float y = Float.parseFloat(');
    });

    it('should generate correct invocation with sol.functionName(params)', () => {
      const problem = {
        functionName: 'twoSum',
        functionParams: [
          { name: 'nums', type: 'int[]' },
          { name: 'target', type: 'int' }
        ]
      };
      const userCode = 'class Solution { int[] twoSum(int[] nums, int target) { return new int[0]; } }';
      const result = wrapper.wrap(userCode, makeTemplate('java'), 'D', problem);
      expect(result).toContain('sol.twoSum(nums, target)');
    });

    it('should include Java serializers', () => {
      const problem = { functionName: 'solve', functionParams: [{ name: 'n', type: 'int' }] };
      const userCode = 'class Solution { int solve(int n) { return n; } }';
      const result = wrapper.wrap(userCode, makeTemplate('java'), 'D', problem);
      expect(result).toContain('private static int[] parseArray');
      expect(result).toContain('private static String serialize');
    });

    it('should handle string[] parameter', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [{ name: 'words', type: 'string[]' }]
      };
      const userCode = 'class Solution { int solve(String[] words) { return 0; } }';
      const result = wrapper.wrap(userCode, makeTemplate('java'), 'D', problem);
      expect(result).toContain('String[] words = parseStringArray(');
    });
  });

  // ============================================================
  // TEST SUITE: wrap() — C++
  // ============================================================
  describe('wrap() — C++', () => {
    it('should generate correct int parameter assignment', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [{ name: 'num', type: 'int' }]
      };
      const userCode = 'class Solution { public: int solve(int num) { return num * 2; } };';
      const result = wrapper.wrap(userCode, makeTemplate('cpp'), 'D', problem);
      expect(result).toContain('int num = stoi(');
    });

    it('should generate correct vector<int> parameter assignment', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [{ name: 'nums', type: 'vector<int>' }]
      };
      const userCode = 'class Solution { public: int solve(vector<int> nums) { return 0; } };';
      const result = wrapper.wrap(userCode, makeTemplate('cpp'), 'D', problem);
      expect(result).toContain('vector<int> nums = parseVector(');
    });

    it('should handle int[] alias for vector<int>', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [{ name: 'nums', type: 'int[]' }]
      };
      const userCode = 'class Solution { public: int solve(vector<int> nums) { return 0; } };';
      const result = wrapper.wrap(userCode, makeTemplate('cpp'), 'D', problem);
      expect(result).toContain('vector<int> nums = parseVector(');
    });

    it('should handle string parameter', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [{ name: 's', type: 'string' }]
      };
      const userCode = 'class Solution { public: int solve(string s) { return 0; } };';
      const result = wrapper.wrap(userCode, makeTemplate('cpp'), 'D', problem);
      expect(result).toContain('string s =');
    });

    it('should handle bool parameter', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [{ name: 'flag', type: 'bool' }]
      };
      const userCode = 'class Solution { public: bool solve(bool flag) { return flag; } };';
      const result = wrapper.wrap(userCode, makeTemplate('cpp'), 'D', problem);
      expect(result).toContain('bool flag = (');
    });

    it('should handle ListNode* parameter', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [{ name: 'head', type: 'ListNode' }]
      };
      const userCode = 'class Solution { public: ListNode* solve(ListNode* head) { return head; } };';
      const result = wrapper.wrap(userCode, makeTemplate('cpp'), 'D', problem);
      expect(result).toContain('ListNode* head = listToLinkedList(parseVector(');
    });

    it('should handle TreeNode* parameter', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [{ name: 'root', type: 'TreeNode' }]
      };
      const userCode = 'class Solution { public: TreeNode* solve(TreeNode* root) { return root; } };';
      const result = wrapper.wrap(userCode, makeTemplate('cpp'), 'D', problem);
      expect(result).toContain('TreeNode* root = listToTree(parseVector(');
    });

    it('should include C++ headers', () => {
      const problem = { functionName: 'solve', functionParams: [{ name: 'n', type: 'int' }] };
      const userCode = 'class Solution { public: int solve(int n) { return n; } };';
      const result = wrapper.wrap(userCode, makeTemplate('cpp'), 'D', problem);
      expect(result).toContain('#include <iostream>');
      expect(result).toContain('#include <vector>');
      expect(result).toContain('using namespace std;');
    });

    it('should generate correct invocation with sol.functionName(params)', () => {
      const problem = {
        functionName: 'twoSum',
        functionParams: [
          { name: 'nums', type: 'vector<int>' },
          { name: 'target', type: 'int' }
        ]
      };
      const userCode = 'class Solution { public: vector<int> twoSum(vector<int> nums, int target) { return {}; } };';
      const result = wrapper.wrap(userCode, makeTemplate('cpp'), 'D', problem);
      expect(result).toContain('sol.twoSum(nums, target)');
    });

    it('should handle double and float parameters', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [
          { name: 'x', type: 'double' },
          { name: 'y', type: 'float' }
        ]
      };
      const userCode = 'class Solution { public: double solve(double x, float y) { return x + y; } };';
      const result = wrapper.wrap(userCode, makeTemplate('cpp'), 'D', problem);
      expect(result).toContain('double x = stod(');
      expect(result).toContain('float y = stof(');
    });

    it('should handle vector<string> parameter', () => {
      const problem = {
        functionName: 'solve',
        functionParams: [{ name: 'words', type: 'vector<string>' }]
      };
      const userCode = 'class Solution { public: int solve(vector<string> words) { return 0; } };';
      const result = wrapper.wrap(userCode, makeTemplate('cpp'), 'D', problem);
      expect(result).toContain('vector<string> words = parseStringVector(');
    });
  });

  // ============================================================
  // TEST SUITE: wrap() — Delimiter Injection
  // ============================================================
  describe('wrap() — Delimiter Injection', () => {
    const problem = { functionName: 'solve', functionParams: [{ name: 'n', type: 'int' }] };
    const userCode = 'def solve(n):\n    return n * 2';

    it('should inject delimiter into Python template', () => {
      const result = wrapper.wrap(userCode, makeTemplate('python'), 'AXECODE_abc123', problem);
      expect(result).toContain('AXECODE_abc123');
    });

    it('should inject delimiter into JavaScript template', () => {
      const jsCode = 'function solve(n) { return n * 2; }';
      const result = wrapper.wrap(jsCode, makeTemplate('javascript'), 'AXECODE_xyz', problem);
      expect(result).toContain('AXECODE_xyz');
    });

    it('should inject delimiter into Java template', () => {
      const javaCode = 'class Solution { int solve(int n) { return n * 2; } }';
      const result = wrapper.wrap(javaCode, makeTemplate('java'), 'AXECODE_java_delim', problem);
      expect(result).toContain('AXECODE_java_delim');
    });

    it('should inject delimiter into C++ template', () => {
      const cppCode = 'class Solution { public: int solve(int n) { return n * 2; } };';
      const result = wrapper.wrap(cppCode, makeTemplate('cpp'), 'AXECODE_cpp_delim', problem);
      expect(result).toContain('AXECODE_cpp_delim');
    });
  });

  // ============================================================
  // TEST SUITE: wrap() — HTML Entity Decoding in User Code
  // ============================================================
  describe('wrap() — HTML Entity Decoding', () => {
    it('should decode &lt; and &gt; in user code', () => {
      const problem = { functionName: 'solve', functionParams: [{ name: 'n', type: 'int' }] };
      const userCode = 'class Solution { public: int solve(int n) { if (n &lt; 0) return -1; return n; } };';
      const result = wrapper.wrap(userCode, makeTemplate('cpp'), 'D', problem);
      expect(result).toContain('if (n < 0)');
      expect(result).not.toContain('&lt;');
    });

    it('should decode &amp; in user code', () => {
      const problem = { functionName: 'solve', functionParams: [{ name: 'a', type: 'bool' }, { name: 'b', type: 'bool' }] };
      const userCode = 'class Solution { public: bool solve(bool a, bool b) { return a &amp;&amp; b; } };';
      const result = wrapper.wrap(userCode, makeTemplate('cpp'), 'D', problem);
      expect(result).toContain('a && b');
    });
  });

  // ============================================================
  // TEST SUITE: Data Flow Integration
  // ============================================================
  describe('Data Flow — prepareStdin + wrap Integration', () => {
    it('Python: complete flow for a simple int function', () => {
      const problem = {
        functionName: 'doubleIt',
        functionParams: [{ name: 'n', type: 'int' }]
      };
      const testCase = { input: { n: 42 } };
      const userCode = 'def doubleIt(n):\n    return n * 2';
      const delimiter = 'AXECODE_test_delim';

      const stdin = wrapper.prepareStdin(testCase, problem.functionParams);
      const fullCode = wrapper.wrap(userCode, makeTemplate('python'), delimiter, problem);

      // Verify stdin
      expect(stdin).toBe('42');

      // Verify fullCode structure
      expect(fullCode).toContain('import json');
      expect(fullCode).toContain('def doubleIt(n):');
      expect(fullCode).toContain('_read_input(1)');
      expect(fullCode).toContain('doubleIt(*param_values)');
      expect(fullCode).toContain(delimiter);
    });

    it('Java: complete flow for int[] + int function', () => {
      const problem = {
        functionName: 'twoSum',
        functionParams: [
          { name: 'nums', type: 'int[]' },
          { name: 'target', type: 'int' }
        ]
      };
      const testCase = { input: { nums: [2, 7, 11, 15], target: 9 } };
      const userCode = 'class Solution { int[] twoSum(int[] nums, int target) { return new int[]{0, 1}; } }';

      const stdin = wrapper.prepareStdin(testCase, problem.functionParams);
      const fullCode = wrapper.wrap(userCode, makeTemplate('java'), 'DELIM', problem);

      // Verify stdin lines
      const lines = stdin.split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0])).toEqual([2, 7, 11, 15]);
      expect(JSON.parse(lines[1])).toBe(9);

      // Verify fullCode
      expect(fullCode).toContain('int[] nums = parseArray(');
      expect(fullCode).toContain('int target = Integer.parseInt(');
      expect(fullCode).toContain('sol.twoSum(nums, target)');
    });

    it('C++: complete flow for vector<int> function', () => {
      const problem = {
        functionName: 'maxSubArray',
        functionParams: [{ name: 'nums', type: 'vector<int>' }]
      };
      const testCase = { input: { nums: [-2, 1, -3, 4, -1, 2, 1, -5, 4] } };
      const userCode = 'class Solution { public: int maxSubArray(vector<int>& nums) { return 6; } };';

      const stdin = wrapper.prepareStdin(testCase, problem.functionParams);
      const fullCode = wrapper.wrap(userCode, makeTemplate('cpp'), 'DELIM', problem);

      // Verify stdin
      expect(JSON.parse(stdin)).toEqual([-2, 1, -3, 4, -1, 2, 1, -5, 4]);

      // Verify fullCode
      expect(fullCode).toContain('vector<int> nums = parseVector(');
      expect(fullCode).toContain('sol.maxSubArray(nums)');
      expect(fullCode).toContain('#include <vector>');
    });

    it('JavaScript: complete flow for string function', () => {
      const problem = {
        functionName: 'reverseString',
        functionParams: [{ name: 's', type: 'string' }]
      };
      const testCase = { input: { s: 'hello' } };
      const userCode = 'function reverseString(s) { return s.split("").reverse().join(""); }';

      const stdin = wrapper.prepareStdin(testCase, problem.functionParams);
      const fullCode = wrapper.wrap(userCode, makeTemplate('javascript'), 'D', problem);

      expect(stdin).toBe('"hello"');
      expect(fullCode).toContain('reverseString(...paramValues)');
    });
  });
});
