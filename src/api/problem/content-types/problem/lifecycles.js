"use strict";

/**
 * Problem Lifecycle Hooks
 * Auto-generates code templates when a problem is created/updated
 */

// Note: We don't require the service directly here to avoid circular dependencies
// Instead, we use strapi.service() at runtime

module.exports = {
  async beforeCreate(event) {
    await strapi.service("api::recommendation.recommendation").handleLifecycleEvent(event);
  },
  async beforeUpdate(event) {
    await strapi.service("api::recommendation.recommendation").handleLifecycleEvent(event);
  },
  async afterCreate(event) {
    await generateTemplatesForProblem(event.result);
  },

  async afterUpdate(event) {
    // Only regenerate if function signature changed
    const { data } = event.params;
    if (data.functionName || data.functionParams || data.returnType) {
      await generateTemplatesForProblem(event.result);
    }
  },
};

/**
 * Supported language IDs matching Judge0
 */
const LANGUAGE_IDS = {
  python: 71,
  java: 62,
  javascript: 63,
  cpp: 54,
};

/**
 * Generate code templates for all supported languages
 */
async function generateTemplatesForProblem(problem) {
  if (!problem || !problem.functionName) {
    return;
  }

  const { documentId, functionName, functionParams, returnType } = problem;

  try {
    // Use Strapi's service registry to get the code-template service
    const templateService = strapi.service("api::code-template.code-template");
    
    // Get existing templates
    const existingTemplates = await strapi
      .documents("api::code-template.code-template")
      .findMany({
        filters: {
          problem: { documentId: { $eq: documentId } },
        },
      });

    const existingLanguages = existingTemplates.map((t) => t.language);

    // Generate templates for all languages
    for (const language of Object.keys(LANGUAGE_IDS)) {
      try {
        // Generate starter and wrapper code using inline generation
        const starterCode = generateStarterCode(
          language,
          functionName,
          functionParams,
          returnType
        );
        const wrapperCode = generateWrapperCode(
          language,
          functionName,
          functionParams,
          returnType
        );

        if (existingLanguages.includes(language)) {
          // Update existing template
          const existing = existingTemplates.find((t) => t.language === language);
          await strapi.documents("api::code-template.code-template").update({
            documentId: existing.documentId,
            data: {
              starterCode,
              wrapperCode,
            },
          });
        } else {
          // Create new template
          await strapi.documents("api::code-template.code-template").create({
            data: {
              language,
              starterCode,
              wrapperCode,
              problem: { connect: [documentId] },
              status: "published",
            },
          });
        }
      } catch (error) {
        strapi.log.error(
          `Failed to generate ${language} template for problem ${documentId}:`,
          error.message
        );
      }
    }
  } catch (error) {
    strapi.log.error("Failed to generate templates:", error.message);
  }
}

// ================== INLINE TEMPLATE GENERATORS ==================

function generateStarterCode(language, functionName, params, returnType) {
  params = params || [];
  
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
      return `// ${functionName} - ${language} not supported`;
  }
}

function generateWrapperCode(language, functionName, params, returnType) {
  params = params || [];
  
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
      return `// ${functionName} - ${language} wrapper not supported`;
  }
}

// Python
function generatePythonStarter(functionName, params, returnType) {
  const typeHints = params
    .map((p) => `${p.name}: ${pythonType(p.type)}`)
    .join(", ");
  const returnHint = pythonType(returnType);

  // Clean starter code - only the function signature
  // ListNode/TreeNode classes are included in wrapper code for execution
  return `def ${functionName}(${typeHints}) -> ${returnHint}:
    # Write your solution here
    pass
`;
}

function generatePythonWrapper(functionName, params, returnType) {
  const paramNames = params.map((p) => p.name).join(", ");
  const paramParsing = params
    .map((p) => {
      const { name, type } = p;
      const lowerType = type.toLowerCase();
      if (lowerType === "listnode" || lowerType === "linkedlist") {
        return `    ${name} = list_to_linkedlist(input_data["${name}"])`;
      }
      if (lowerType === "treenode" || lowerType === "binarytree") {
        return `    ${name} = list_to_tree(input_data["${name}"])`;
      }
      return `    ${name} = input_data["${name}"]`;
    })
    .join("\n");

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
    if not arr: return None
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
    if not arr or arr[0] is None: return None
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
    if not root: return []
    result, queue = [], [root]
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

def serialize_result(result):
    if result is None: return None
    if isinstance(result, ListNode): return linkedlist_to_list(result)
    if isinstance(result, TreeNode): return tree_to_list(result)
    return result

# ==== USER CODE ====
{USER_CODE}
# ==== END ====

if __name__ == "__main__":
    input_lines = sys.stdin.read().splitlines()
    param_values = [json.loads(line) for line in input_lines if line.strip()]
    
    # Map params to their values (assuming order is preserved)
    input_data = {}
    # We'll use order-based mapping for simpler logic in wrappers
    # ${params.map((p, i) => `    input_data["${p.name}"] = param_values[${i}]`).join("\n")}
${params.map((p, i) => `    ${p.name}_raw = param_values[${i}]`).join("\n")}
${params
  .map((p) => {
    const { name, type } = p;
    const lowerType = type.toLowerCase();
    if (lowerType === "listnode" || lowerType === "linkedlist") {
      return `    ${name} = list_to_linkedlist(${name}_raw)`;
    }
    if (lowerType === "treenode" || lowerType === "binarytree") {
      return `    ${name} = list_to_tree(${name}_raw)`;
    }
    return `    ${name} = ${name}_raw`;
  })
  .join("\n")}
    
    result = ${functionName}(${paramNames})
    print(json.dumps(serialize_result(result)))
`;
}

// JavaScript
function generateJavaScriptStarter(functionName, params, returnType) {
  const paramList = params.map((p) => p.name).join(", ");
  const jsDocParams = params.length > 0
    ? params.map((p) => ` * @param {${jsDocType(p.type)}} ${p.name}`).join("\n")
    : " * @param {any} params";

  return `/**
${jsDocParams}
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
    .map((p) => {
      const { name, type } = p;
      const lowerType = type.toLowerCase();
      if (lowerType === "listnode") return `    const ${name} = listToLinkedList(input["${name}"]);`;
      if (lowerType === "treenode") return `    const ${name} = listToTree(input["${name}"]);`;
      return `    const ${name} = input["${name}"];`;
    })
    .join("\n");

  return `function ListNode(val, next) { this.val = val || 0; this.next = next || null; }
function TreeNode(val, left, right) { this.val = val || 0; this.left = left || null; this.right = right || null; }

function listToLinkedList(arr) {
    if (!arr || !arr.length) return null;
    let head = new ListNode(arr[0]), current = head;
    for (let i = 1; i < arr.length; i++) { current.next = new ListNode(arr[i]); current = current.next; }
    return head;
}
function linkedListToList(head) { const result = []; while (head) { result.push(head.val); head = head.next; } return result; }
function listToTree(arr) {
    if (!arr || !arr.length || arr[0] === null) return null;
    const root = new TreeNode(arr[0]), queue = [root];
    let i = 1;
    while (queue.length && i < arr.length) {
        const node = queue.shift();
        if (i < arr.length && arr[i] !== null) { node.left = new TreeNode(arr[i]); queue.push(node.left); } i++;
        if (i < arr.length && arr[i] !== null) { node.right = new TreeNode(arr[i]); queue.push(node.right); } i++;
    }
    return root;
}
function treeToList(root) {
    if (!root) return [];
    const result = [], queue = [root];
    while (queue.length) {
        const node = queue.shift();
        if (node) { result.push(node.val); queue.push(node.left, node.right); } else result.push(null);
    }
    while (result.length && result[result.length - 1] === null) result.pop();
    return result;
}
function serialize(result) {
    if (result instanceof ListNode) return linkedListToList(result);
    if (result instanceof TreeNode) return treeToList(result);
    return result;
}

// ==== USER CODE ====
{USER_CODE}
// ==== END ====

let input = '';
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
    const lines = input.split('\\n').filter(l => l.trim());
    const paramValues = lines.map(l => JSON.parse(l));
    
${params.map((p, i) => {
  const { name, type } = p;
  const lowerType = type.toLowerCase();
  if (lowerType === "listnode") return `    const ${name} = listToLinkedList(paramValues[${i}]);`;
  if (lowerType === "treenode") return `    const ${name} = listToTree(paramValues[${i}]);`;
  return `    const ${name} = paramValues[${i}];`;
}).join("\n")}

    console.log(JSON.stringify(serialize(${functionName}(${paramNames}))));
});
`;
}

// Java
function generateJavaStarter(functionName, params, returnType) {
  const paramList = params.map((p) => `${javaType(p.type)} ${p.name}`).join(", ");
  return `class Solution {
    public ${javaType(returnType)} ${functionName}(${paramList}) {
        // Write your solution here
        
    }
}
`;
}

function generateJavaWrapper(functionName, params, returnType) {
  const paramNames = params.map((p) => p.name).join(", ");
  const paramParsing = params
    .map((p, i) => {
      const { name, type } = p;
      const lowerType = type.toLowerCase();
      if (lowerType === "vector<int>" || lowerType === "array<int>" || lowerType === "int[]" || lowerType === "array<integer>") {
           return `        int[] ${name} = parseArray(inputLines.get(${i}));`;
      }
      if (lowerType === "vector<string>" || lowerType === "array<string>" || lowerType === "string[]") {
           return `        String[] ${name} = parseStringArray(inputLines.get(${i}));`;
      }
      if (lowerType === "int" || lowerType === "integer") {
           return `        int ${name} = Integer.parseInt(inputLines.get(${i}));`;
      }
      if (lowerType === "string") {
           return `        String ${name} = inputLines.get(${i}).substring(1, inputLines.get(${i}).length() - 1);`;
      }
      if (lowerType === "listnode") {
           return `        ListNode ${name} = listToLinkedList(parseArray(inputLines.get(${i})));`;
      }
      if (lowerType === "treenode") {
           return `        TreeNode ${name} = listToTree(parseArray(inputLines.get(${i})));`;
      }
      return `        Object ${name} = inputLines.get(${i});`;
    })
    .join("\n");

  return `import java.util.*;

class ListNode {
    int val;
    ListNode next;
    ListNode(int x) { val = x; }
}

class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode(int x) { val = x; }
}

// User Solution
{USER_CODE}

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        List<String> inputLines = new ArrayList<>();
        while (sc.hasNextLine()) {
            String line = sc.nextLine();
            if (!line.isEmpty()) inputLines.add(line);
        }
        
        Solution sol = new Solution();
${paramParsing}
        
        Object result = sol.${functionName}(${paramNames});
        System.out.println(serialize(result));
    }

    private static int[] parseArray(String s) {
        if (s == null || s.length() <= 2 || s.equals("null")) return new int[0];
        String[] parts = s.substring(1, s.length() - 1).split(",");
        int[] res = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            String p = parts[i].trim();
            if (p.equals("null")) res[i] = -1000000000; // convention
            else res[i] = Integer.parseInt(p);
        }
        return res;
    }

    private static String[] parseStringArray(String s) {
        s = s.trim();
        if (s.equals("[]") || s.equals("null")) return new String[0];
        s = s.substring(1, s.length() - 1); // remove [ ]
        java.util.List<String> result = new java.util.ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuote = false;
        for (char c : s.toCharArray()) {
            if (c == '"') inQuote = !inQuote;
            else if (c == ',' && !inQuote) {
                if (current.length() > 0) result.add(current.toString());
                current = new StringBuilder();
            } else if (inQuote) {
                current.append(c);
            }
        }
        if (current.length() > 0) result.add(current.toString());
        return result.toArray(new String[0]);
    }

    private static ListNode listToLinkedList(int[] arr) {
        if (arr.length == 0) return null;
        ListNode head = new ListNode(arr[0]);
        ListNode curr = head;
        for (int i = 1; i < arr.length; i++) {
            curr.next = new ListNode(arr[i]);
            curr = curr.next;
        }
        return head;
    }

    private static TreeNode listToTree(int[] arr) {
        if (arr.length == 0 || arr[0] == -1000000000) return null;
        TreeNode root = new TreeNode(arr[0]);
        Queue<TreeNode> q = new LinkedList<>();
        q.add(root);
        int i = 1;
        while (!q.isEmpty() && i < arr.length) {
            TreeNode curr = q.poll();
            if (i < arr.length && arr[i] != -1000000000) {
                curr.left = new TreeNode(arr[i]);
                q.add(curr.left);
            }
            i++;
            if (i < arr.length && arr[i] != -1000000000) {
                curr.right = new TreeNode(arr[i]);
                q.add(curr.right);
            }
            i++;
        }
        return root;
    }

    private static String serialize(Object obj) {
        if (obj == null) return "null";
        if (obj instanceof int[]) {
            int[] arr = (int[]) obj;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < arr.length; i++) {
                sb.append(arr[i]);
                if (i < arr.length - 1) sb.append(",");
            }
            sb.append("]");
            return sb.toString();
        }
        if (obj instanceof ListNode) {
            ListNode head = (ListNode) obj;
            StringBuilder sb = new StringBuilder("[");
            while (head != null) {
                sb.append(head.val);
                if (head.next != null) sb.append(",");
                head = head.next;
            }
            sb.append("]");
            return sb.toString();
        }
        if (obj instanceof TreeNode) {
            TreeNode root = (TreeNode) obj;
            List<String> res = new ArrayList<>();
            Queue<TreeNode> q = new LinkedList<>();
            q.add(root);
            while (!q.isEmpty()) {
                TreeNode curr = q.poll();
                if (curr != null) {
                    res.add(String.valueOf(curr.val));
                    q.add(curr.left);
                    q.add(curr.right);
                } else {
                    res.add("null");
                }
            }
            while (!res.isEmpty() && res.get(res.size() - 1).equals("null")) {
                res.remove(res.size() - 1);
            }
            return "[" + String.join(",", res) + "]";
        }
        return obj.toString();
    }
}
`;
}

// C++
function generateCppStarter(functionName, params, returnType) {
  const paramList = params.map((p) => `${cppType(p.type, true)} ${p.name}`).join(", ");
  return `class Solution {
public:
    ${cppType(returnType)} ${functionName}(${paramList}) {
        // Write your solution here
        
    }
};
`;
}

function generateCppWrapper(functionName, params, returnType) {
  const paramNames = params.map((p) => p.name).join(", ");
  const paramParsing = params
    .map((p, i) => {
      const { name, type } = p;
      const lowerType = type.toLowerCase();
      if (lowerType === "vector<int>" || lowerType === "array<int>" || lowerType === "array<integer>") {
           return `    vector<int> ${name} = parseVector(inputLines[${i}]);`;
      }
      if (lowerType === "vector<string>" || lowerType === "array<string>" || lowerType === "string[]") {
           return `    vector<string> ${name} = parseStringVector(inputLines[${i}]);`;
      }
      if (lowerType === "int" || lowerType === "integer") {
           return `    int ${name} = stoi(inputLines[${i}]);`;
      }
      if (lowerType === "string") {
           return `    string ${name} = inputLines[${i}].substr(1, inputLines[${i}].length() - 2); // remove quotes`;
      }
      if (lowerType === "listnode") {
           return `    ListNode* ${name} = listToLinkedList(parseVector(inputLines[${i}]));`;
      }
      if (lowerType === "treenode") {
           return `    TreeNode* ${name} = listToTree(parseVector(inputLines[${i}]));`;
      }
      return `    auto ${name} = inputLines[${i}]; // fallback`;
    })
    .join("\n");

  return `#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
#include <queue>

using namespace std;

struct ListNode {
    int val;
    ListNode *next;
    ListNode(int x) : val(x), next(NULL) {}
};

struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode(int x) : val(x), left(NULL), right(NULL) {}
};

vector<int> parseVector(string s) {
    vector<int> res;
    if (s == "[]" || s == "null") return res;
    s = s.substr(1, s.length() - 2);
    stringstream ss(s);
    string item;
    while (getline(ss, item, ',')) {
        if (item == "null") res.push_back(-1e9); // convention for null in int vector?
        else res.push_back(stoi(item));
    }
    return res;
}

vector<string> parseStringVector(string s) {
    vector<string> res;
    if (s == "[]" || s == "null") return res;
    s = s.substr(1, s.length() - 2); // remove [ ]
    stringstream ss(s);
    string item;
    bool inQuote = false;
    string current = "";
    for (char c : s) {
        if (c == '"') inQuote = !inQuote;
        else if (c == ',' && !inQuote) {
            if (!current.empty()) res.push_back(current);
            current = "";
        } else if (inQuote) {
            current += c;
        }
    }
    if (!current.empty()) res.push_back(current);
    return res;
}

ListNode* listToLinkedList(vector<int> v) {
    if (v.empty()) return NULL;
    ListNode* head = new ListNode(v[0]);
    ListNode* curr = head;
    for (size_t i = 1; i < v.size(); i++) {
        curr->next = new ListNode(v[i]);
        curr = curr->next;
    }
    return head;
}

TreeNode* listToTree(vector<int> v) {
    if (v.empty() || v[0] == -1e9) return NULL;
    TreeNode* root = new TreeNode(v[0]);
    queue<TreeNode*> q;
    q.push(root);
    size_t i = 1;
    while (!q.empty() && i < v.size()) {
        TreeNode* curr = q.front(); q.pop();
        if (i < v.size() && v[i] != -1e9) {
            curr->left = new TreeNode(v[i]);
            q.push(curr->left);
        }
        i++;
        if (i < v.size() && v[i] != -1e9) {
            curr->right = new TreeNode(v[i]);
            q.push(curr->right);
        }
        i++;
    }
    return root;
}

// Serialization helpers for C++
string serialize(int v) { return to_string(v); }
string serialize(bool v) { return v ? "true" : "false"; }
string serialize(string v) { return "\"" + v + "\""; }
string serialize(vector<int> v) {
    string res = "[";
    for (size_t i = 0; i < v.size(); i++) {
        res += to_string(v[i]);
        if (i < v.size() - 1) res += ",";
    }
    res += "]";
    return res;
}
string serialize(ListNode* head) {
    string res = "[";
    while (head) {
        res += to_string(head->val);
        if (head->next) res += ",";
        head = head->next;
    }
    res += "]";
    return res;
}
string serialize(TreeNode* root) {
    if (!root) return "[]";
    string res = "[";
    queue<TreeNode*> q;
    q.push(root);
    vector<string> vals;
    while (!q.empty()) {
        TreeNode* curr = q.front(); q.pop();
        if (curr) {
            vals.push_back(to_string(curr->val));
            q.push(curr->left);
            q.push(curr->right);
        } else {
            vals.push_back("null");
        }
    }
    while (!vals.empty() && vals.back() == "null") vals.pop_back();
    for (size_t i = 0; i < vals.size(); i++) {
        res += vals[i];
        if (i < vals.size() - 1) res += ",";
    }
    res += "]";
    return res;
}

// User Solution
{USER_CODE}

int main() {
    string line;
    vector<string> inputLines;
    while (getline(cin, line)) {
        if (!line.empty()) inputLines.push_back(line);
    }
    
    Solution sol;
${paramParsing}
    
    // Execute and print
    auto result = sol.${functionName}(${paramNames});
    cout << serialize(result) << endl;
    return 0;
}
`;
}

// Type helpers
function pythonType(type) {
  if (!type) return "Any";
  const t = type.toLowerCase();
  if (t.startsWith("array<")) return `List[${pythonType(t.slice(6, -1))}]`;
  if (t === "integer" || t === "int") return "int";
  if (t === "string") return "str";
  if (t === "boolean" || t === "bool") return "bool";
  if (t === "listnode") return "Optional[ListNode]";
  if (t === "treenode") return "Optional[TreeNode]";
  return "Any";
}

function jsDocType(type) {
  if (!type) return "*";
  const t = type.toLowerCase();
  if (t.startsWith("array<")) return `${jsDocType(t.slice(6, -1))}[]`;
  if (t === "integer" || t === "int" || t === "float") return "number";
  if (t === "string") return "string";
  if (t === "boolean") return "boolean";
  if (t === "listnode") return "ListNode";
  if (t === "treenode") return "TreeNode";
  return "*";
}

function javaType(type) {
  if (!type) return "Object";
  const t = type.toLowerCase();
  if (t.startsWith("array<")) {
    const inner = t.slice(6, -1);
    if (inner === "integer" || inner === "int") return "int[]";
    return javaType(inner) + "[]";
  }
  if (t === "integer" || t === "int") return "int";
  if (t === "string") return "String";
  if (t === "boolean") return "boolean";
  if (t === "listnode") return "ListNode";
  if (t === "treenode") return "TreeNode";
  return "Object";
}

function cppType(type, isParam = false) {
  if (!type) return "auto";
  const t = type.toLowerCase();
  
  if (t.startsWith("array<")) {
    const inner = cppType(t.slice(6, -1));
    return isParam ? `vector<${inner}>&` : `vector<${inner}>`;
  }
  
  if (t === "integer" || t === "int") return "int";
  if (t === "string") return isParam ? "string&" : "string";
  if (t === "boolean") return "bool";
  if (t === "listnode") return "ListNode*";
  if (t === "treenode") return "TreeNode*";
  return "auto";
}
