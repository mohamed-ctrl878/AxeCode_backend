'use strict';

const path = require('path');
const fs = require('fs');

console.log('[Product Controller] Loading code.js');

// إعدادات الأمان والحدود
const SECURITY_CONFIG = {
  MAX_CODE_SIZE: 10000, // حروف
  MAX_EXECUTION_TIME: 10000, // مللي ثانية
  MAX_MEMORY_USAGE: 100 * 1024 * 1024, // 100 ميجابايت
  MAX_OUTPUT_SIZE: 1024 * 1024, // 1 ميجابايت
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
    "system",
    "exec",
    "popen",
    "fork",
    "kill",
    "signal",
    "mmap",
    "shmget",
    "shmat",
    "shmdt",
    "shmctl",
    "socket",
    "bind",
    "listen",
    "accept",
    "connect",
    "open",
    "creat",
    "unlink",
    "remove",
    "rename",
    "chmod",
    "chown",
    "mkdir",
    "rmdir",
    "link",
    "symlink",
    "mount",
    "umount",
    "reboot",
    "shutdown",
    "halt",
    "network",
    "http",
    "curl",
    "wget",
    "ftp",
    "ssh",
    "database",
    "mysql",
    "postgresql",
    "sqlite",
    "file",
    "directory",
    "process",
    "thread",
    "pipe",
    "semaphore",
    "mutex",
    "condition_variable",
    "atomic",
    "memory_order",
    "volatile",
    "register",
  ],
};

module.exports = {
  async executeCode(ctx) {
    console.log('[Product Controller] Execute method called');
    console.log('[Product Controller] Request body:', JSON.stringify(ctx.request.body, null, 2));

    // تصحيح هيكل البيانات إذا كانت مغلفة في كائن request
    const requestData = ctx.request.body.request || ctx.request.body;
    console.log('[Product Controller] Processed request data:', JSON.stringify(requestData, null, 2));

    const dockerService = strapi.service('api::product.docker-executor');
    console.log('[Product Controller] Docker service:', dockerService);
    
    try {
      const {
        language,
        code,
        testCases,
        functionName,
        functionReturnType,
        expected,
      } = requestData;

      // فحص حجم الكود
      if (code && code.length > SECURITY_CONFIG.MAX_CODE_SIZE) {
        return ctx.badRequest(
          `Code size exceeds limit of ${SECURITY_CONFIG.MAX_CODE_SIZE} characters`
        );
      }

      // فحص عدد حالات الاختبار
      if (testCases && testCases.length > SECURITY_CONFIG.MAX_TEST_CASES) {
        return ctx.badRequest(
          `Number of test cases exceeds limit of ${SECURITY_CONFIG.MAX_TEST_CASES}`
        );
      }

      // فحص الكود للأوامر المحظورة
      const codeLower = code.toLowerCase();
      for (const keyword of SECURITY_CONFIG.FORBIDDEN_KEYWORDS) {
        if (codeLower.includes(keyword.toLowerCase())) {
          return ctx.badRequest(`Forbidden keyword detected: ${keyword}`);
        }
      }

      if (language !== "cpp") {
        return ctx.badRequest("Unsupported language");
      }

      if (!code || code.trim() === "") {
        return ctx.badRequest("Invalid code input");
      }

      if (!Array.isArray(testCases) || testCases.length === 0) {
        return ctx.badRequest("Invalid or missing test cases");
      }

      if (
        !functionName ||
        typeof functionName !== "string" ||
        !functionReturnType
      ) {
        return ctx.badRequest(
          "Invalid or missing function name or return type"
        );
      }

      // التحقق من وجود expected array
      if (!Array.isArray(expected) || expected.length !== testCases.length) {
        return ctx.badRequest("Invalid or missing expected results array");
      }

      console.log('[Product Controller] Creating temporary directory');
      const tmpDir = path.join(__dirname, "tmp");
      console.log('[Product Controller] Temporary directory path:', tmpDir);
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
        console.log('[Product Controller] Temporary directory created successfully');
      } catch (error) {
        return ctx.send({
          compileError:
            "Failed to create temporary directory: " + error.message,
          results: [],
        });
      }
      const filename = `temp_${Date.now()}.cpp`;
      const filepath = path.join(tmpDir, filename);

      const libraries = `
#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <sstream>
#include <queue>
#include <stack>
#include <stdexcept>
#include <chrono>
#include <functional>
#include <algorithm>
#include <cmath>
using namespace std;


  struct ListNode {
      int val;
      ListNode *next;
      ListNode() : val(0), next(nullptr) {}
      ListNode(int x) : val(x), next(nullptr) {}
      ListNode(int x, ListNode *next) : val(x), next(next) {}
  };

    struct TreeNode {
      int val;
      TreeNode *left;
      TreeNode *right;
      TreeNode() : val(0), left(nullptr), right(nullptr) {}
      TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
      TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
  };
`;

      const solutionCode = code.trim().startsWith("class Solution")
        ? code
        : `class Solution { 
public: 
${code} 
};`;
      const testCode = `
int main() {
  Solution sol;`;

      let inputTests = "";
      const errors = [];
      const results = [];

      testCases.forEach((testCase, testCaseIndex) => {
        const testId = testCase.id || testCaseIndex + 1;
        const inputVars = [];
        inputTests += `  // Test Case ${testId}\n`;
        inputTests += `  auto start${testCaseIndex + 1} = chrono::high_resolution_clock::now();\n`;
        testCase.inputs.forEach((input, i) => {
          const inputType = testCase.inputTypes[i];
          let inputVar = `input${testCaseIndex + 1}_${i + 1}`;
          inputVars.push(inputVar);
          try {
            switch (inputType) {
              case "vector<int>":
                inputTests += `  vector<int> ${inputVar} = {${input.map((x) => parseInt(x, 10) || x).join(",")}};\n`;
                break;
              case "int":
                inputTests += `  int ${inputVar} = ${parseInt(input, 10) || input};\n`;
                break;
              case "double":
                inputTests += `  double ${inputVar} = ${parseFloat(input) || input};\n`;
                break;
              case "string":
                inputTests += `  string ${inputVar} = \"${input}\";\n`;
                break;
              case "char":
                inputTests += `  char ${inputVar} = '${input}';\n`;
                break;
              case "vector<double>":
                inputTests += `  vector<double> ${inputVar} = {${input.map((x) => parseFloat(x) || x).join(",")}};\n`;
                break;
              case "vector<string>":
                inputTests += `  vector<string> ${inputVar} = {${input.map((x) => `\"${x}\"`).join(",")}};\n`;
                break;
              case "bool":
                inputTests += `  bool ${inputVar} = ${input ? "true" : "false"};\n`;
                break;
              case "vector<bool>":
                inputTests += `  vector<bool> ${inputVar} = {${input.map((x) => (x ? "true" : "false")).join(",")}};\n`;
                break;
              case "TreeNode*": {
                inputTests += `  TreeNode* ${inputVar} = nullptr;\n`;
                // معالجة القيم null وتحويلها إلى -1
                const processedInput = input.map((val) =>
                  val === null || val === "null" ? -1 : val
                );
                inputTests += `  vector<int> treeValues_${testCaseIndex + 1}_${i + 1} = {${processedInput.join(",")}};\n`;
                inputTests += `  if (!treeValues_${testCaseIndex + 1}_${i + 1}.empty()) {\n`;
                inputTests += `    queue<TreeNode**> nodes;\n`;
                inputTests += `    nodes.push(&${inputVar});\n`;
                inputTests += `    for (size_t idx = 0; idx < treeValues_${testCaseIndex + 1}_${i + 1}.size(); ++idx) {\n`;
                inputTests += `      TreeNode** node = nodes.front(); nodes.pop();\n`;
                inputTests += `      if (treeValues_${testCaseIndex + 1}_${i + 1}[idx] != -1) {\n`;
                inputTests += `        *node = new TreeNode(treeValues_${testCaseIndex + 1}_${i + 1}[idx]);\n`;
                inputTests += `        nodes.push(&((*node)->left));\n`;
                inputTests += `        nodes.push(&((*node)->right));\n`;
                inputTests += `      }\n`;
                inputTests += `    }\n`;
                inputTests += `  }\n`;
                break;
              }
              case "ListNode*":
                inputTests += `  ListNode* ${inputVar} = nullptr;\n`;
                // معالجة القيم null وتحويلها إلى -1
                const processedListInput = input.map((val) =>
                  val === null || val === "null" ? -1 : val
                );
                inputTests += `  vector<int> listValues_${testCaseIndex + 1}_${i + 1} = {${processedListInput.join(",")}};\n`;
                inputTests += `  if (!listValues_${testCaseIndex + 1}_${i + 1}.empty()) {\n`;
                inputTests += `    // بناء القائمة المرتبطة مع تجاهل القيم -1\n`;
                inputTests += `    for (size_t i = 0; i < listValues_${testCaseIndex + 1}_${i + 1}.size(); ++i) {\n`;
                inputTests += `      if (listValues_${testCaseIndex + 1}_${i + 1}[i] != -1) {\n`;
                inputTests += `        if (${inputVar} == nullptr) {\n`;
                inputTests += `          ${inputVar} = new ListNode(listValues_${testCaseIndex + 1}_${i + 1}[i]);\n`;
                inputTests += `        } else {\n`;
                inputTests += `          ListNode* current = ${inputVar};\n`;
                inputTests += `          while (current->next != nullptr) {\n`;
                inputTests += `            current = current->next;\n`;
                inputTests += `          }\n`;
                inputTests += `          current->next = new ListNode(listValues_${testCaseIndex + 1}_${i + 1}[i]);\n`;
                inputTests += `        }\n`;
                inputTests += `      }\n`;
                inputTests += `    }\n`;
                inputTests += `  }\n`;
                break;
              default:
                errors.push(
                  `Unsupported input type: ${inputType} in test case ${testId}`
                );
                return;
            }
          } catch (e) {
            errors.push(
              `Error processing input type: ${inputType} in test case ${testId}`
            );
          }
        });

        const functionCall = `sol.${functionName}(${inputVars.join(", ")})`;
        inputTests += `  auto result${testCaseIndex + 1} = ${functionCall};\n`;
        inputTests += `  auto end${testCaseIndex + 1} = chrono::high_resolution_clock::now();\n`;
        inputTests += `  auto duration${testCaseIndex + 1} = chrono::duration_cast<chrono::microseconds>(end${testCaseIndex + 1} - start${testCaseIndex + 1}).count();\n`;
        inputTests += `  cout << \"TEST_CASE_${testId}:${testId}:\" << duration${testCaseIndex + 1} << \":\";\n`;
        // طباعة النتيجة فقط بدون أي رموز إضافية
        switch (functionReturnType) {
          case "int":
          case "double":
          case "bool":
            inputTests += `  cout << result${testCaseIndex + 1} << endl;\n`;
            break;
          case "string":
            inputTests += `  cout << result${testCaseIndex + 1} << endl;\n`;
            break;
          case "vector<int>":
          case "vector<double>":
          case "vector<string>":
          case "vector<bool>":
            inputTests += `  for (size_t i = 0; i < result${testCaseIndex + 1}.size(); ++i) { cout << result${testCaseIndex + 1}[i]; if (i < result${testCaseIndex + 1}.size() - 1) cout << ","; } cout << endl;\n`;
            break;
          case "set<int>":
            inputTests += `  for (auto it = result${testCaseIndex + 1}.begin(); it != result${testCaseIndex + 1}.end(); ++it) { cout << *it; if (next(it) != result${testCaseIndex + 1}.end()) cout << ","; } cout << endl;\n`;
            break;
          case "map<string, int>":
            inputTests += `  for (auto it = result${testCaseIndex + 1}.begin(); it != result${testCaseIndex + 1}.end(); ++it) { cout << it->first << ":" << it->second; if (next(it) != result${testCaseIndex + 1}.end()) cout << ","; } cout << endl;\n`;
            break;
          case "TreeNode*":
            inputTests += `  vector<int> resultTreeValues_${testCaseIndex + 1};\n`;
            inputTests += `  function<void(TreeNode*)> traverse_${testCaseIndex + 1} = [&](TreeNode* node) { if (!node) return; resultTreeValues_${testCaseIndex + 1}.push_back(node->val); traverse_${testCaseIndex + 1}(node->left); traverse_${testCaseIndex + 1}(node->right); };\n`;
            inputTests += `  traverse_${testCaseIndex + 1}(result${testCaseIndex + 1});\n`;
            inputTests += `  for (size_t i = 0; i < resultTreeValues_${testCaseIndex + 1}.size(); ++i) { cout << resultTreeValues_${testCaseIndex + 1}[i]; if (i < resultTreeValues_${testCaseIndex + 1}.size() - 1) cout << ","; } cout << endl;\n`;
            break;
          case "ListNode*":
            inputTests += `  vector<int> resultListValues_${testCaseIndex + 1};\n`;
            inputTests += `  ListNode* current_${testCaseIndex + 1} = result${testCaseIndex + 1};\n`;
            inputTests += `  while (current_${testCaseIndex + 1} != nullptr) {\n`;
            inputTests += `    resultListValues_${testCaseIndex + 1}.push_back(current_${testCaseIndex + 1}->val);\n`;
            inputTests += `    current_${testCaseIndex + 1} = current_${testCaseIndex + 1}->next;\n`;
            inputTests += `  }\n`;
            inputTests += `  if (resultListValues_${testCaseIndex + 1}.empty()) {\n`;
            inputTests += `    cout << endl;\n`;
            inputTests += `  } else {\n`;
            inputTests += `    for (size_t i = 0; i < resultListValues_${testCaseIndex + 1}.size(); ++i) { cout << resultListValues_${testCaseIndex + 1}[i]; if (i < resultListValues_${testCaseIndex + 1}.size() - 1) cout << ","; } cout << endl;\n`;
            inputTests += `  }\n`;
            break;
          default:
            inputTests += `  cout << \"Unsupported result type\" << endl;\n`;
            break;
        }
      });

      const fullCode =
        libraries + solutionCode + testCode + inputTests + "  return 0;\n}";

      // فحص أن الكود يحتوي على العناصر الأساسية
      if (
        !fullCode.includes("class Solution") &&
        !fullCode.includes("int main()")
      ) {
        return ctx.send({
          compileError: "Generated code is missing required components",
          results: [],
        });
      }

      console.log('[Product Controller] Writing code to file:', filepath);
      fs.writeFileSync(filepath, fullCode);
      console.log('[Product Controller] Code written successfully');

      // طباعة الكود المُنشأ للتحقق
      console.log("Generated C++ Code:");
      console.log("=".repeat(50));
      console.log(fullCode);
      console.log("=".repeat(50));

      // فحص أن الملف تم إنشاؤه بنجاح
      if (!fs.existsSync(filepath)) {
        return ctx.send({
          compileError: "Failed to create temporary file",
          results: [],
        });
      }

      try {
        console.log("[Product Controller] Executing code in Docker container");
        console.log("[Product Controller] Docker service available:", !!dockerService);
        console.log("[Product Controller] Docker executor available:", !!this.dockerExecutor);

        // تنفيذ الكود في حاوية Docker
        const executionOutput = await dockerService.execute(fullCode, testCases);

        // فحص حجم النتيجة
        if (
          executionOutput.output &&
          executionOutput.output.length > SECURITY_CONFIG.MAX_OUTPUT_SIZE
        ) {
          return ctx.send({
            compileError: "Output size exceeds limit",
            results: [],
          });
        }

        // طباعة النتيجة الكاملة من التنفيذ
        console.log("EXECUTION OUTPUT:", executionOutput.output);
        console.log("EXIT CODE:", executionOutput.exitCode);
        console.log("ERROR:", executionOutput.error);

        if (executionOutput.error) {
          return ctx.send({
            compileError: "Execution error: " + executionOutput.error,
            results: [],
          });
        }

        if (errors.length > 0) {
          return ctx.send({
            compileError:
              "Errors detected during input parsing:\n" + errors.join("\n"),
            results: [],
          });
        }

        // تحليل النتائج
        const outputLines = executionOutput.output
          .split("\n")
          .filter((line) => line.trim());
        console.log("FILTERED OUTPUT LINES:", outputLines);

        const testResults = [];
        outputLines.forEach((line) => {
          // طباعة السطر للمراجعة
          console.log("OUTPUT_LINE:", line);
          if (line.startsWith("TEST_CASE_")) {
            // إزالة \r من نهاية السطر
            const cleanLine = line.replace(/\r$/, "");
            console.log("CLEAN_LINE:", cleanLine);
            const parts = cleanLine.split(":");
            console.log("PARTS:", parts);
            console.log("PARTS_LENGTH:", parts.length);

            if (parts.length >= 4) {
              try {
                // طباعة كل جزء بشكل منفصل للتأكد
                console.log("PART 0:", parts[0], "TYPE:", typeof parts[0]);
                console.log("PART 1:", parts[1], "TYPE:", typeof parts[1]);
                console.log("PART 2:", parts[2], "TYPE:", typeof parts[2]);
                console.log("PART 3:", parts[3], "TYPE:", typeof parts[3]);
                console.log(
                  "PART 4+:",
                  parts.slice(4),
                  "TYPE:",
                  typeof parts.slice(4)
                );

                const testId = parseInt(parts[1]);
                const id = parseInt(parts[1]); // نفس testId
                const result = parts[3]; // النتيجة في الجزء الرابع (index 3)
                const time = 0; // الوقت ثابت حالياً

                console.log("PARSED VALUES:", { testId, id, time, result });
                console.log("PARSED TYPES:", {
                  testId: typeof testId,
                  id: typeof id,
                  time: typeof time,
                  result: typeof result,
                });

                const expectedResult =
                  expected[testCases.findIndex((tc) => tc.id === id)];

                // حماية شاملة - التحقق من undefined/null
                if (expectedResult === undefined || expectedResult === null) {
                  console.log(
                    "ERROR: expectedResult is undefined/null for test ID:",
                    id
                  );
                  console.log("expected array:", expected);
                  console.log("testCases:", testCases);
                  console.log(
                    "testCases.findIndex result:",
                    testCases.findIndex((tc) => tc.id === id)
                  );
                  return;
                }

                console.log(
                  "EXPECTED_RESULT:",
                  expectedResult,
                  "TYPE:",
                  typeof expectedResult,
                  "IS_ARRAY:",
                  Array.isArray(expectedResult)
                );

                let actualResult;
                try {
                  if (typeof expectedResult === "number") {
                    actualResult = parseFloat(result);
                  } else if (typeof expectedResult === "boolean") {
                    // Handle boolean values (C++ returns 1/0, we need true/false)
                    actualResult = result === "1" || result === "true";
                  } else if (Array.isArray(expectedResult)) {
                    // Handle vector outputs (comma-separated values)
                    if (result.trim() === "") {
                      // Empty result - return empty array
                      actualResult = [];
                    } else if (result.includes(",")) {
                      actualResult = result.split(",").map((x) => {
                        const trimmed = x.trim();
                        if (trimmed === "true") return true;
                        if (trimmed === "false") return false;
                        const num = parseFloat(trimmed);
                        return isNaN(num) ? trimmed : num;
                      });
                    } else {
                      // Single value that should be in array
                      const num = parseFloat(result);
                      actualResult = isNaN(num) ? [result] : [num];
                    }
                  } else {
                    actualResult = result;
                  }
                } catch (e) {
                  console.log("PARSE ERROR:", e.message);
                  actualResult = result;
                }

                // حماية إضافية للـ actualResult
                if (actualResult === undefined || actualResult === null) {
                  console.log(
                    "ERROR: actualResult is undefined/null for test ID:",
                    id
                  );
                  console.log("Raw result:", result);
                  return;
                }

                // Special logging for ListNode* (linked list)
                if (
                  Array.isArray(expectedResult) &&
                  typeof expectedResult[0] === "number" &&
                  typeof actualResult === "object"
                ) {
                  console.log("[ListNode*] expectedResult:", expectedResult);
                  console.log("[ListNode*] actualResult:", actualResult);
                  console.log(
                    "[ListNode*] expectedResult.length:",
                    expectedResult.length
                  );
                  console.log(
                    "[ListNode*] actualResult.length:",
                    actualResult.length
                  );
                }

                console.log("COMPARISON:", { expectedResult, actualResult });
                console.log("COMPARISON TYPES:", {
                  expectedResult: typeof expectedResult,
                  actualResult: typeof actualResult,
                });

                const isPassed =
                  JSON.stringify(actualResult) ===
                  JSON.stringify(expectedResult);
                console.log("IS_PASSED:", isPassed);

                testResults.push({
                  id: id,
                  status: isPassed ? "PASSED" : "FAILED",
                  expected: expectedResult,
                  actual: actualResult,
                  executionTime: time,
                  executionTimeMs: (time / 1000).toFixed(2),
                });
              } catch (error) {
                console.log("ERROR processing test result:", error.message);
                console.log("Line:", line);
                console.log("Parts:", parts);
              }
            } else {
              console.log("INSUFFICIENT PARTS:", parts.length, "NEEDED: 4");
            }
          }
        });

        ctx.send({
          compileError: null,
          results: testResults,
        });
      } catch (error) {
        console.error("Execution error:", error);

        // تنظيف الملفات المؤقتة في حالة الخطأ
        try {
          if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
          if (fs.existsSync(`${filepath}.exe`))
            fs.unlinkSync(`${filepath}.exe`);
        } catch (cleanupError) {
          console.error("Cleanup error:", cleanupError);
        }

        // إرجاع رسالة خطأ أكثر تفصيلاً
        if (error.message.includes("Compilation timeout")) {
          ctx.send({
            error:
              "Compilation timeout - the code is too complex or there's a compilation issue. Please check your code syntax.",
          });
        } else if (error.message.includes("Execution timeout")) {
          ctx.send({
            error:
              "Execution timeout - the program took too long to run. Please optimize your algorithm.",
          });
        } else {
          ctx.send({ error: "Failed to execute code: " + error.message });
        }
      } finally {
        // تنظيف الملفات المؤقتة
        fs.rm(tmpDir, { recursive: true, force: true }, (err) => {
          if (err) console.error("Error deleting tmp directory:", err);
        });
      }
    } catch (err) {
      console.error("Top-level error:", err);
      ctx.send({ error: "Failed to execute code: " + err.message });
    }
  },
};

/*
request case:
{
  "language": "cpp",
  "code": "string nn(){return \"kfmvkmf\";}string repeatString(string str, int times) { string result = \"\"; while (times-- > 0) result += str; return result; };",  
  "testCases": [
    { "inputs": ["hello", 3], "inputTypes": ["string", "int"] },
    { "inputs": ["abc", 5], "inputTypes": ["string", "int"] }
  ],
  "functionName": "repeatString",
  "functionReturnType": "string"
}





or 





{
  "language": "cpp",
  "code": "double averageVector(vector<double> nums) { double sum = 0; for (double num : nums) sum += num; return sum / nums.size(); }",
  "testCases": [
    { "inputs": [[1.0, 2.0, 3.0]], "inputTypes": ["vector<double>"] },
    { "inputs": [[4.5, 5.5, 6.5, 7.5]], "inputTypes": ["vector<double>"] }
  ],
  "functionName": "averageVector",
  "functionReturnType": "double"
}


/////////////////////////////////////////////////////////////////////////////////

response case :
{
  "compileError": null,
  "results": [
    "[Test case 1] Output: [2][Test case 2] Output: [6]"
    ]
    }
    
    */

/////////////////////////////////////////////////////////////////////////////////
