const axios = require("axios");

const BASE_URL = "http://localhost:1338/api/code-execution";

// Advanced test cases for edge cases and complex scenarios
const advancedTests = [
  // Test 1: Binary Tree Operations
  {
    name: "Binary Tree Inorder Traversal",
    request: {
      language: "cpp",
      code: `
vector<int> inorderTraversal(TreeNode* root) {
    vector<int> result;
    stack<TreeNode*> st;
    TreeNode* current = root;
    
    while (current != nullptr || !st.empty()) {
        while (current != nullptr) {
            st.push(current);
            current = current->left;
        }
        current = st.top();
        st.pop();
        result.push_back(current->val);
        current = current->right;
    }
    return result;
}`,
      functionName: "inorderTraversal",
      functionReturnType: "vector<int>",
      testCases: [
        {
          id: 1001,
          inputs: [[1, null, 2, 3]],
          inputTypes: ["TreeNode*"],
        },
      ],
      expected: [[1, 3, 2]],
    },
  },

  // Test 2: Complex String Operations
  {
    name: "Longest Common Subsequence",
    request: {
      language: "cpp",
      code: `
int longestCommonSubsequence(string text1, string text2) {
    int m = text1.length();
    int n = text2.length();
    vector<vector<int>> dp(m + 1, vector<int>(n + 1, 0));
    
    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (text1[i-1] == text2[j-1]) {
                dp[i][j] = dp[i-1][j-1] + 1;
            } else {
                dp[i][j] = max(dp[i-1][j], dp[i][j-1]);
            }
        }
    }
    return dp[m][n];
}`,
      functionName: "longestCommonSubsequence",
      functionReturnType: "int",
      testCases: [
        {
          id: 1002,
          inputs: ["abcde", "ace"],
          inputTypes: ["string", "string"],
        },
        {
          id: 1003,
          inputs: ["abc", "def"],
          inputTypes: ["string", "string"],
        },
      ],
      expected: [3, 0],
    },
  },

  // Test 3: Vector of Vectors
  {
    name: "Matrix Transpose",
    request: {
      language: "cpp",
      code: `
vector<vector<int>> transpose(vector<vector<int>>& matrix) {
    int m = matrix.size();
    int n = matrix[0].size();
    vector<vector<int>> result(n, vector<int>(m));
    
    for (int i = 0; i < m; i++) {
        for (int j = 0; j < n; j++) {
            result[j][i] = matrix[i][j];
        }
    }
    return result;
}`,
      functionName: "transpose",
      functionReturnType: "vector<vector<int>>",
      testCases: [
        {
          id: 1004,
          inputs: [
            [
              [1, 2, 3],
              [4, 5, 6],
              [7, 8, 9],
            ],
          ],
          inputTypes: ["vector<vector<int>>"],
        },
      ],
      expected: [
        [
          [1, 4, 7],
          [2, 5, 8],
          [3, 6, 9],
        ],
      ],
    },
  },

  // Test 4: Edge Case - Empty Vector
  {
    name: "Empty Vector Handling",
    request: {
      language: "cpp",
      code: `
int findMax(vector<int>& nums) {
    if (nums.empty()) return -1;
    return *max_element(nums.begin(), nums.end());
}`,
      functionName: "findMax",
      functionReturnType: "int",
      testCases: [
        {
          id: 1005,
          inputs: [[]],
          inputTypes: ["vector<int>"],
        },
        {
          id: 1006,
          inputs: [[1, 5, 3, 9, 2]],
          inputTypes: ["vector<int>"],
        },
      ],
      expected: [-1, 9],
    },
  },

  // Test 5: Large Numbers
  {
    name: "Large Number Operations",
    request: {
      language: "cpp",
      code: `
long long fibonacci(int n) {
    if (n <= 1) return n;
    long long prev = 0, curr = 1;
    for (int i = 2; i <= n; i++) {
        long long next = prev + curr;
        prev = curr;
        curr = next;
    }
    return curr;
}`,
      functionName: "fibonacci",
      functionReturnType: "long long",
      testCases: [
        {
          id: 1007,
          inputs: [10],
          inputTypes: ["int"],
        },
        {
          id: 1008,
          inputs: [20],
          inputTypes: ["int"],
        },
      ],
      expected: [55, 6765],
    },
  },

  // Test 6: Complex Boolean Logic
  {
    name: "Complex Boolean Logic",
    request: {
      language: "cpp",
      code: `
bool isValidParentheses(string s) {
    stack<char> st;
    for (char c : s) {
        if (c == '(' || c == '{' || c == '[') {
            st.push(c);
        } else {
            if (st.empty()) return false;
            char top = st.top();
            if ((c == ')' && top == '(') || 
                (c == '}' && top == '{') || 
                (c == ']' && top == '[')) {
                st.pop();
            } else {
                return false;
            }
        }
    }
    return st.empty();
}`,
      functionName: "isValidParentheses",
      functionReturnType: "bool",
      testCases: [
        {
          id: 1009,
          inputs: ["()"],
          inputTypes: ["string"],
        },
        {
          id: 1010,
          inputs: ["([)]"],
          inputTypes: ["string"],
        },
        {
          id: 1011,
          inputs: ["{[]}"],
          inputTypes: ["string"],
        },
      ],
      expected: [true, false, true],
    },
  },

  // Test 7: Performance Test - Large Input
  {
    name: "Performance Test - Large Vector",
    request: {
      language: "cpp",
      code: `
int sumLargeVector(vector<int>& nums) {
    int sum = 0;
    for (int num : nums) {
        sum += num;
    }
    return sum;
}`,
      functionName: "sumLargeVector",
      functionReturnType: "int",
      testCases: [
        {
          id: 1012,
          inputs: [Array.from({ length: 1000 }, (_, i) => i + 1)],
          inputTypes: ["vector<int>"],
        },
      ],
      expected: [500500],
    },
  },

  // Test 8: Error Handling - Division by Zero
  {
    name: "Division by Zero Test",
    request: {
      language: "cpp",
      code: `
int divide(int a, int b) {
    if (b == 0) {
        throw runtime_error("Division by zero");
    }
    return a / b;
}`,
      functionName: "divide",
      functionReturnType: "int",
      testCases: [
        {
          id: 1013,
          inputs: [10, 0],
          inputTypes: ["int", "int"],
        },
      ],
      expected: [0],
    },
  },

  // Test 9: Mixed Data Types
  {
    name: "Mixed Data Types Test",
    request: {
      language: "cpp",
      code: `
string processMixedData(int num, string text, bool flag) {
    string result = "Number: " + to_string(num) + ", Text: " + text + ", Flag: " + (flag ? "true" : "false");
    return result;
}`,
      functionName: "processMixedData",
      functionReturnType: "string",
      testCases: [
        {
          id: 1014,
          inputs: [42, "hello", true],
          inputTypes: ["int", "string", "bool"],
        },
      ],
      expected: ["Number: 42, Text: hello, Flag: true"],
    },
  },

  // Test 10: Recursive Function
  {
    name: "Recursive Function Test",
    request: {
      language: "cpp",
      code: `
int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}`,
      functionName: "factorial",
      functionReturnType: "int",
      testCases: [
        {
          id: 1015,
          inputs: [5],
          inputTypes: ["int"],
        },
        {
          id: 1016,
          inputs: [0],
          inputTypes: ["int"],
        },
      ],
      expected: [120, 1],
    },
  },
];

async function runAdvancedTest(testCase) {
  console.log(`\n🔬 Running Advanced Test: ${testCase.name}`);
  console.log("=".repeat(60));

  try {
    const startTime = Date.now();
    const response = await axios.post(BASE_URL, testCase.request);
    const endTime = Date.now();

    console.log(`⏱️  Request Time: ${endTime - startTime}ms`);

    if (response.data.compileError) {
      console.log(`❌ Compilation Error: ${response.data.compileError}`);
      return false;
    }

    if (response.data.runtimeError) {
      console.log(`❌ Runtime Error: ${response.data.runtimeError}`);
      return false;
    }

    console.log("📊 Results:");
    response.data.results.forEach((result) => {
      console.log(`  Test ID ${result.id}:`);
      console.log(`    Input: ${JSON.stringify(result.inputs)}`);
      console.log(`    Expected: ${JSON.stringify(result.expected)}`);
      console.log(`    Output: ${result.output}`);
      console.log(`    Execution Time: ${result.time}`);
      console.log(`    Status: ${result.status}`);
      console.log("");
    });

    const allPassed = response.data.results.every(
      (result) => result.status === "PASS"
    );
    console.log(allPassed ? "✅ Test passed!" : "❌ Test failed!");

    return allPassed;
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    if (error.response?.data) {
      console.log(
        `Error details: ${JSON.stringify(error.response.data, null, 2)}`
      );
    }
    return false;
  }
}

async function runAllAdvancedTests() {
  console.log("🚀 Starting Advanced Code Execution Tests");
  console.log("=".repeat(70));

  let passedTests = 0;
  let totalTests = advancedTests.length;

  for (const testCase of advancedTests) {
    const result = await runAdvancedTest(testCase);
    if (result) passedTests++;

    // Add delay between tests
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  console.log("\n" + "=".repeat(70));
  console.log("📈 Advanced Test Summary:");
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(
    `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`
  );

  if (passedTests === totalTests) {
    console.log(
      "🎉 All advanced tests passed! The system handles complex scenarios perfectly!"
    );
  } else {
    console.log(
      "⚠️  Some advanced tests failed. The system may need improvements for edge cases."
    );
  }
}

// Run the advanced tests
runAllAdvancedTests().catch(console.error);
