"use strict";

/**
 * Code Template Generators
 * Generates starter code and wrapper code for each supported language
 */

/**
 * Supported language IDs matching Judge0
 */
const LANGUAGE_IDS = {
  python: 71, // Python 3
  java: 62, // Java (OpenJDK 13)
  javascript: 63, // JavaScript (Node.js 12)
  cpp: 54, // C++ (GCC 9.2)
};

/**
 * Generate starter code for a problem
 * This is what the user sees in the editor
 */
function generateStarterCode(language, functionName, functionParams, returnType) {
  const params = functionParams || [];

  switch (language) {
    case "python":
      return generatePythonStarter(functionName, params, returnType);
    case "java":
      return generateJavaStarter(functionName, params, returnType);
    case "javascript":
      return generateJavaScriptStarter(functionName, params, returnType);
    case "cpp":
      return generateCppStarter(functionName, params, returnType);
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

/**
 * Generate wrapper code for a problem
 * This wraps the user's code to handle I/O and execute test cases
 */
function generateWrapperCode(language, functionName, functionParams, returnType) {
  const params = functionParams || [];

  switch (language) {
    case "python":
      return generatePythonWrapper(functionName, params, returnType);
    case "java":
      return generateJavaWrapper(functionName, params, returnType);
    case "javascript":
      return generateJavaScriptWrapper(functionName, params, returnType);
    case "cpp":
      return generateCppWrapper(functionName, params, returnType);
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

// ==================== PYTHON ====================

function generatePythonStarter(functionName, params, returnType) {
  const paramList = params.map((p) => p.name).join(", ");
  const typeHints = params
    .map((p) => `${p.name}: ${pythonType(p.type)}`)
    .join(", ");
  const returnHint = pythonType(returnType);

  return `from typing import List, Optional

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def ${functionName}(${typeHints}) -> ${returnHint}:
    # Write your solution here
    pass
`;
}

function generatePythonWrapper(functionName, params, returnType) {
  const paramNames = params.map((p) => p.name).join(", ");
  const paramParsing = params
    .map((p) => generatePythonParamParsing(p))
    .join("\n    ");

  return `import json
import sys
from typing import List, Optional

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def list_to_linkedlist(arr):
    if not arr:
        return None
    head = ListNode(arr[0])
    current = head
    for val in arr[1:]:
        current.next = ListNode(val)
        current = current.next
    return head

def linkedlist_to_list(head):
    result = []
    while head:
        result.append(head.val)
        head = head.next
    return result

def list_to_tree(arr):
    if not arr or arr[0] is None:
        return None
    root = TreeNode(arr[0])
    queue = [root]
    i = 1
    while queue and i < len(arr):
        node = queue.pop(0)
        if i < len(arr) and arr[i] is not None:
            node.left = TreeNode(arr[i])
            queue.append(node.left)
        i += 1
        if i < len(arr) and arr[i] is not None:
            node.right = TreeNode(arr[i])
            queue.append(node.right)
        i += 1
    return root

def tree_to_list(root):
    if not root:
        return []
    result = []
    queue = [root]
    while queue:
        node = queue.pop(0)
        if node:
            result.append(node.val)
            queue.append(node.left)
            queue.append(node.right)
        else:
            result.append(None)
    while result and result[-1] is None:
        result.pop()
    return result

def serialize_result(result, return_type):
    if result is None:
        return None
    if isinstance(result, ListNode):
        return linkedlist_to_list(result)
    if isinstance(result, TreeNode):
        return tree_to_list(result)
    return result

# ==== USER CODE START ====
{USER_CODE}
# ==== USER CODE END ====

if __name__ == "__main__":
    test_data = json.loads(sys.stdin.read())
    input_data = test_data["input"]
    
    ${paramParsing}
    
    result = ${functionName}(${paramNames})
    result = serialize_result(result, "${returnType}")
    
    print(json.dumps(result))
`;
}

function generatePythonParamParsing(param) {
  const { name, type } = param;
  const lowerType = type.toLowerCase();

  if (lowerType === "listnode" || lowerType === "linkedlist") {
    return `${name} = list_to_linkedlist(input_data["${name}"])`;
  }
  if (lowerType === "treenode" || lowerType === "binarytree") {
    return `${name} = list_to_tree(input_data["${name}"])`;
  }
  return `${name} = input_data["${name}"]`;
}

function pythonType(type) {
  if (!type) return "Any";
  const lowerType = type.toLowerCase();

  if (lowerType.startsWith("array<")) {
    const inner = lowerType.slice(6, -1);
    return `List[${pythonType(inner)}]`;
  }
  if (lowerType.startsWith("matrix<")) {
    const inner = lowerType.slice(7, -1);
    return `List[List[${pythonType(inner)}]]`;
  }

  switch (lowerType) {
    case "integer":
    case "int":
      return "int";
    case "float":
    case "double":
      return "float";
    case "string":
      return "str";
    case "boolean":
    case "bool":
      return "bool";
    case "listnode":
    case "linkedlist":
      return "Optional[ListNode]";
    case "treenode":
    case "binarytree":
      return "Optional[TreeNode]";
    default:
      return "Any";
  }
}

// ==================== JAVASCRIPT ====================

function generateJavaScriptStarter(functionName, params, returnType) {
  const paramList = params.map((p) => p.name).join(", ");

  return `/**
 * Definition for singly-linked list.
 * function ListNode(val, next) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.next = (next===undefined ? null : next)
 * }
 */

/**
 * Definition for a binary tree node.
 * function TreeNode(val, left, right) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.left = (left===undefined ? null : left)
 *     this.right = (right===undefined ? null : right)
 * }
 */

/**
 * @param {${params.map((p) => jsDocType(p.type) + " " + p.name).join(", ")}}
 * @return {${jsDocType(returnType)}}
 */
var ${functionName} = function(${paramList}) {
    // Write your solution here
    
};
`;
}

function generateJavaScriptWrapper(functionName, params, returnType) {
  const paramNames = params.map((p) => p.name).join(", ");
  const paramParsing = params
    .map((p) => generateJsParamParsing(p))
    .join("\n    ");

  return `function ListNode(val, next) {
    this.val = (val === undefined ? 0 : val);
    this.next = (next === undefined ? null : next);
}

function TreeNode(val, left, right) {
    this.val = (val === undefined ? 0 : val);
    this.left = (left === undefined ? null : left);
    this.right = (right === undefined ? null : right);
}

function listToLinkedList(arr) {
    if (!arr || arr.length === 0) return null;
    let head = new ListNode(arr[0]);
    let current = head;
    for (let i = 1; i < arr.length; i++) {
        current.next = new ListNode(arr[i]);
        current = current.next;
    }
    return head;
}

function linkedListToList(head) {
    const result = [];
    while (head) {
        result.push(head.val);
        head = head.next;
    }
    return result;
}

function listToTree(arr) {
    if (!arr || arr.length === 0 || arr[0] === null) return null;
    const root = new TreeNode(arr[0]);
    const queue = [root];
    let i = 1;
    while (queue.length > 0 && i < arr.length) {
        const node = queue.shift();
        if (i < arr.length && arr[i] !== null) {
            node.left = new TreeNode(arr[i]);
            queue.push(node.left);
        }
        i++;
        if (i < arr.length && arr[i] !== null) {
            node.right = new TreeNode(arr[i]);
            queue.push(node.right);
        }
        i++;
    }
    return root;
}

function treeToList(root) {
    if (!root) return [];
    const result = [];
    const queue = [root];
    while (queue.length > 0) {
        const node = queue.shift();
        if (node) {
            result.push(node.val);
            queue.push(node.left);
            queue.push(node.right);
        } else {
            result.push(null);
        }
    }
    while (result.length > 0 && result[result.length - 1] === null) {
        result.pop();
    }
    return result;
}

function serializeResult(result) {
    if (result === null || result === undefined) return null;
    if (result instanceof ListNode) return linkedListToList(result);
    if (result instanceof TreeNode) return treeToList(result);
    return result;
}

// ==== USER CODE START ====
{USER_CODE}
// ==== USER CODE END ====

const readline = require('readline');
let inputData = '';

process.stdin.on('data', (chunk) => {
    inputData += chunk;
});

process.stdin.on('end', () => {
    const testData = JSON.parse(inputData);
    const input = testData.input;
    
    ${paramParsing}
    
    let result = ${functionName}(${paramNames});
    result = serializeResult(result);
    
    console.log(JSON.stringify(result));
});
`;
}

function generateJsParamParsing(param) {
  const { name, type } = param;
  const lowerType = type.toLowerCase();

  if (lowerType === "listnode" || lowerType === "linkedlist") {
    return `const ${name} = listToLinkedList(input["${name}"]);`;
  }
  if (lowerType === "treenode" || lowerType === "binarytree") {
    return `const ${name} = listToTree(input["${name}"]);`;
  }
  return `const ${name} = input["${name}"];`;
}

function jsDocType(type) {
  if (!type) return "*";
  const lowerType = type.toLowerCase();

  if (lowerType.startsWith("array<")) {
    const inner = lowerType.slice(6, -1);
    return `${jsDocType(inner)}[]`;
  }
  if (lowerType.startsWith("matrix<")) {
    const inner = lowerType.slice(7, -1);
    return `${jsDocType(inner)}[][]`;
  }

  switch (lowerType) {
    case "integer":
    case "int":
    case "float":
    case "double":
      return "number";
    case "string":
      return "string";
    case "boolean":
    case "bool":
      return "boolean";
    case "listnode":
    case "linkedlist":
      return "ListNode";
    case "treenode":
    case "binarytree":
      return "TreeNode";
    default:
      return "*";
  }
}

// ==================== JAVA ====================

function generateJavaStarter(functionName, params, returnType) {
  const paramList = params.map((p) => `${javaType(p.type)} ${p.name}`).join(", ");
  const retType = javaType(returnType);

  return `/**
 * Definition for singly-linked list.
 * public class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode() {}
 *     ListNode(int val) { this.val = val; }
 *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }
 * }
 */

/**
 * Definition for a binary tree node.
 * public class TreeNode {
 *     int val;
 *     TreeNode left;
 *     TreeNode right;
 *     TreeNode() {}
 *     TreeNode(int val) { this.val = val; }
 *     TreeNode(int val, TreeNode left, TreeNode right) {
 *         this.val = val;
 *         this.left = left;
 *         this.right = right;
 *     }
 * }
 */

class Solution {
    public ${retType} ${functionName}(${paramList}) {
        // Write your solution here
        
    }
}
`;
}

function generateJavaWrapper(functionName, params, returnType) {
  const paramNames = params.map((p) => p.name).join(", ");
  const paramDeclarations = params
    .map((p) => generateJavaParamParsing(p))
    .join("\n            ");
  const retType = javaType(returnType);

  return `import java.util.*;
import org.json.*;

class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}

class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}

// ==== USER CODE START ====
{USER_CODE}
// ==== USER CODE END ====

public class Main {
    public static ListNode listToLinkedList(JSONArray arr) throws JSONException {
        if (arr == null || arr.length() == 0) return null;
        ListNode head = new ListNode(arr.getInt(0));
        ListNode current = head;
        for (int i = 1; i < arr.length(); i++) {
            current.next = new ListNode(arr.getInt(i));
            current = current.next;
        }
        return head;
    }

    public static JSONArray linkedListToList(ListNode head) throws JSONException {
        JSONArray result = new JSONArray();
        while (head != null) {
            result.put(head.val);
            head = head.next;
        }
        return result;
    }

    public static TreeNode listToTree(JSONArray arr) throws JSONException {
        if (arr == null || arr.length() == 0 || arr.isNull(0)) return null;
        TreeNode root = new TreeNode(arr.getInt(0));
        Queue<TreeNode> queue = new LinkedList<>();
        queue.offer(root);
        int i = 1;
        while (!queue.isEmpty() && i < arr.length()) {
            TreeNode node = queue.poll();
            if (i < arr.length() && !arr.isNull(i)) {
                node.left = new TreeNode(arr.getInt(i));
                queue.offer(node.left);
            }
            i++;
            if (i < arr.length() && !arr.isNull(i)) {
                node.right = new TreeNode(arr.getInt(i));
                queue.offer(node.right);
            }
            i++;
        }
        return root;
    }

    public static JSONArray treeToList(TreeNode root) throws JSONException {
        JSONArray result = new JSONArray();
        if (root == null) return result;
        Queue<TreeNode> queue = new LinkedList<>();
        queue.offer(root);
        while (!queue.isEmpty()) {
            TreeNode node = queue.poll();
            if (node != null) {
                result.put(node.val);
                queue.offer(node.left);
                queue.offer(node.right);
            } else {
                result.put(JSONObject.NULL);
            }
        }
        while (result.length() > 0 && result.isNull(result.length() - 1)) {
            result.remove(result.length() - 1);
        }
        return result;
    }

    public static void main(String[] args) throws Exception {
        Scanner scanner = new Scanner(System.in);
        StringBuilder sb = new StringBuilder();
        while (scanner.hasNextLine()) {
            sb.append(scanner.nextLine());
        }
        
        JSONObject testData = new JSONObject(sb.toString());
        JSONObject input = testData.getJSONObject("input");
        
        Solution solution = new Solution();
        
        try {
            ${paramDeclarations}
            
            ${retType} result = solution.${functionName}(${paramNames});
            
            ${generateJavaResultSerialization(returnType)}
        } catch (Exception e) {
            System.out.println("Error: " + e.getMessage());
        }
    }
}
`;
}

function generateJavaParamParsing(param) {
  const { name, type } = param;
  const lowerType = type.toLowerCase();
  const jType = javaType(type);

  if (lowerType === "listnode" || lowerType === "linkedlist") {
    return `ListNode ${name} = listToLinkedList(input.getJSONArray("${name}"));`;
  }
  if (lowerType === "treenode" || lowerType === "binarytree") {
    return `TreeNode ${name} = listToTree(input.getJSONArray("${name}"));`;
  }
  if (lowerType.startsWith("array<")) {
    return `int[] ${name} = toIntArray(input.getJSONArray("${name}"));`;
  }
  if (lowerType === "integer" || lowerType === "int") {
    return `int ${name} = input.getInt("${name}");`;
  }
  if (lowerType === "string") {
    return `String ${name} = input.getString("${name}");`;
  }
  if (lowerType === "boolean" || lowerType === "bool") {
    return `boolean ${name} = input.getBoolean("${name}");`;
  }
  return `${jType} ${name} = input.get("${name}");`;
}

function generateJavaResultSerialization(returnType) {
  const lowerType = returnType?.toLowerCase() || "";

  if (lowerType === "listnode" || lowerType === "linkedlist") {
    return `System.out.println(linkedListToList(result).toString());`;
  }
  if (lowerType === "treenode" || lowerType === "binarytree") {
    return `System.out.println(treeToList(result).toString());`;
  }
  if (lowerType.startsWith("array<")) {
    return `System.out.println(new JSONArray(result).toString());`;
  }
  return `System.out.println(new JSONObject().put("result", result).get("result"));`;
}

function javaType(type) {
  if (!type) return "Object";
  const lowerType = type.toLowerCase();

  if (lowerType.startsWith("array<")) {
    const inner = lowerType.slice(6, -1);
    if (inner === "integer" || inner === "int") return "int[]";
    if (inner === "string") return "String[]";
    return javaType(inner) + "[]";
  }
  if (lowerType.startsWith("matrix<")) {
    const inner = lowerType.slice(7, -1);
    if (inner === "integer" || inner === "int") return "int[][]";
    return javaType(inner) + "[][]";
  }

  switch (lowerType) {
    case "integer":
    case "int":
      return "int";
    case "float":
      return "float";
    case "double":
      return "double";
    case "string":
      return "String";
    case "boolean":
    case "bool":
      return "boolean";
    case "listnode":
    case "linkedlist":
      return "ListNode";
    case "treenode":
    case "binarytree":
      return "TreeNode";
    default:
      return "Object";
  }
}

// ==================== C++ ====================

function generateCppStarter(functionName, params, returnType) {
  const paramList = params.map((p) => `${cppType(p.type)} ${p.name}`).join(", ");
  const retType = cppType(returnType);

  return `/**
 * Definition for singly-linked list.
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode() : val(0), next(nullptr) {}
 *     ListNode(int x) : val(x), next(nullptr) {}
 *     ListNode(int x, ListNode *next) : val(x), next(next) {}
 * };
 */

/**
 * Definition for a binary tree node.
 * struct TreeNode {
 *     int val;
 *     TreeNode *left;
 *     TreeNode *right;
 *     TreeNode() : val(0), left(nullptr), right(nullptr) {}
 *     TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
 *     TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
 * };
 */

class Solution {
public:
    ${retType} ${functionName}(${paramList}) {
        // Write your solution here
        
    }
};
`;
}

function generateCppWrapper(functionName, params, returnType) {
  const paramNames = params.map((p) => p.name).join(", ");
  const paramDeclarations = params
    .map((p) => generateCppParamParsing(p))
    .join("\n    ");
  const retType = cppType(returnType);

  return `#include <iostream>
#include <vector>
#include <queue>
#include <string>
#include <sstream>
#include "json.hpp"

using namespace std;
using json = nlohmann::json;

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

ListNode* vectorToLinkedList(vector<int>& arr) {
    if (arr.empty()) return nullptr;
    ListNode* head = new ListNode(arr[0]);
    ListNode* current = head;
    for (int i = 1; i < arr.size(); i++) {
        current->next = new ListNode(arr[i]);
        current = current->next;
    }
    return head;
}

vector<int> linkedListToVector(ListNode* head) {
    vector<int> result;
    while (head) {
        result.push_back(head->val);
        head = head->next;
    }
    return result;
}

TreeNode* vectorToTree(vector<json>& arr) {
    if (arr.empty() || arr[0].is_null()) return nullptr;
    TreeNode* root = new TreeNode(arr[0].get<int>());
    queue<TreeNode*> q;
    q.push(root);
    int i = 1;
    while (!q.empty() && i < arr.size()) {
        TreeNode* node = q.front();
        q.pop();
        if (i < arr.size() && !arr[i].is_null()) {
            node->left = new TreeNode(arr[i].get<int>());
            q.push(node->left);
        }
        i++;
        if (i < arr.size() && !arr[i].is_null()) {
            node->right = new TreeNode(arr[i].get<int>());
            q.push(node->right);
        }
        i++;
    }
    return root;
}

json treeToVector(TreeNode* root) {
    if (!root) return json::array();
    json result = json::array();
    queue<TreeNode*> q;
    q.push(root);
    while (!q.empty()) {
        TreeNode* node = q.front();
        q.pop();
        if (node) {
            result.push_back(node->val);
            q.push(node->left);
            q.push(node->right);
        } else {
            result.push_back(nullptr);
        }
    }
    while (!result.empty() && result.back().is_null()) {
        result.erase(result.end() - 1);
    }
    return result;
}

// ==== USER CODE START ====
{USER_CODE}
// ==== USER CODE END ====

int main() {
    string inputStr;
    string line;
    while (getline(cin, line)) {
        inputStr += line;
    }
    
    json testData = json::parse(inputStr);
    json input = testData["input"];
    
    Solution solution;
    
    ${paramDeclarations}
    
    ${retType} result = solution.${functionName}(${paramNames});
    
    ${generateCppResultSerialization(returnType)}
    
    return 0;
}
`;
}

function generateCppParamParsing(param) {
  const { name, type } = param;
  const lowerType = type.toLowerCase();
  const cType = cppType(type);

  if (lowerType === "listnode" || lowerType === "linkedlist") {
    return `vector<int> ${name}_arr = input["${name}"].get<vector<int>>();
    ListNode* ${name} = vectorToLinkedList(${name}_arr);`;
  }
  if (lowerType === "treenode" || lowerType === "binarytree") {
    return `vector<json> ${name}_arr = input["${name}"].get<vector<json>>();
    TreeNode* ${name} = vectorToTree(${name}_arr);`;
  }
  if (lowerType.startsWith("array<")) {
    return `${cType} ${name} = input["${name}"].get<${cType}>();`;
  }
  if (lowerType === "integer" || lowerType === "int") {
    return `int ${name} = input["${name}"].get<int>();`;
  }
  if (lowerType === "string") {
    return `string ${name} = input["${name}"].get<string>();`;
  }
  if (lowerType === "boolean" || lowerType === "bool") {
    return `bool ${name} = input["${name}"].get<bool>();`;
  }
  return `${cType} ${name} = input["${name}"];`;
}

function generateCppResultSerialization(returnType) {
  const lowerType = returnType?.toLowerCase() || "";

  if (lowerType === "listnode" || lowerType === "linkedlist") {
    return `json output = linkedListToVector(result);
    cout << output.dump() << endl;`;
  }
  if (lowerType === "treenode" || lowerType === "binarytree") {
    return `json output = treeToVector(result);
    cout << output.dump() << endl;`;
  }
  return `json output = result;
    cout << output.dump() << endl;`;
}

function cppType(type) {
  if (!type) return "auto";
  const lowerType = type.toLowerCase();

  if (lowerType.startsWith("array<")) {
    const inner = lowerType.slice(6, -1);
    return `vector<${cppType(inner)}>`;
  }
  if (lowerType.startsWith("matrix<")) {
    const inner = lowerType.slice(7, -1);
    return `vector<vector<${cppType(inner)}>>`;
  }

  switch (lowerType) {
    case "integer":
    case "int":
      return "int";
    case "float":
      return "float";
    case "double":
      return "double";
    case "string":
      return "string";
    case "boolean":
    case "bool":
      return "bool";
    case "listnode":
    case "linkedlist":
      return "ListNode*";
    case "treenode":
    case "binarytree":
      return "TreeNode*";
    default:
      return "auto";
  }
}

module.exports = {
  LANGUAGE_IDS,
  generateStarterCode,
  generateWrapperCode,
};
