'use strict';

/**
 * CodeWrapper Service
 * Responsible for preparing the final source code by injecting user code into templates.
 * Supports dynamic placeholders: {USER_CODE}, {DELIMITER}, {IMPORTS}, {COMMON_CLASSES}, {SERIALIZERS}, {FUNCTION_NAME}, {INVOCATION}, {PARAM_ASSIGNMENTS}
 */

const BOILERPLATE = {
    javascript: {
        imports: '',
        commonClasses: `
function ListNode(val, next) { this.val = val || 0; this.next = next || null; }
function TreeNode(val, left, right) { this.val = val || 0; this.left = left || null; this.right = right || null; }
function listToLinkedList(arr) {
    if (!arr || !arr.length) return null;
    let head = new ListNode(arr[0]), current = head;
    for (let i = 1; i < arr.length; i++) { current.next = new ListNode(arr[i]); current = current.next; }
    return head;
}
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
`,
        serializers: `
function linkedListToList(head) { const result = []; while (head) { result.push(head.val); head = head.next; } return result; }
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
`
    },
    python: {
        imports: 'import json\nimport sys\nfrom typing import List, Optional',
        commonClasses: `
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
`,
        serializers: `
def linkedlist_to_list(head):
    result = []
    while head:
        result.append(head.val)
        head = head.next
    return result
def tree_to_list(root):
    if (!root): return []
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
`
    },
    java: {
        imports: 'import java.util.*;',
        commonClasses: `
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
`,
        serializers: `
    private static int[] parseArray(String s) {
        if (s == null || s.length() <= 2 || s.equals("null")) return new int[0];
        String[] parts = s.substring(1, s.length() - 1).split(",");
        int[] res = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            String p = parts[i].trim();
            if (p.equals("null")) res[i] = -1000000000;
            else res[i] = Integer.parseInt(p);
        }
        return res;
    }
    private static String[] parseStringArray(String s) {
        s = s.trim();
        if (s.equals("[]") || s.equals("null")) return new String[0];
        s = s.substring(1, s.length() - 1);
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
        for (int i = 1; i < arr.length; i++) { curr.next = new ListNode(arr[i]); curr = curr.next; }
        return head;
    }
    private static TreeNode listToTree(int[] arr) {
        if (arr.length == 0 || arr[0] == -1000000000) return null;
        TreeNode root = new TreeNode(arr[0]);
        Queue<TreeNode> q = new LinkedList<>();
        q.add(root); int i = 1;
        while (!q.isEmpty() && i < arr.length) {
            TreeNode curr = q.poll();
            if (i < arr.length && arr[i] != -1000000000) { curr.left = new TreeNode(arr[i]); q.add(curr.left); } i++;
            if (i < arr.length && arr[i] != -1000000000) { curr.right = new TreeNode(arr[i]); q.add(curr.right); } i++;
        }
        return root;
    }
    private static String serialize(Object obj) {
        if (obj == null) return "null";
        if (obj instanceof int[]) {
            int[] arr = (int[]) obj;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < arr.length; i++) { sb.append(arr[i]); if (i < arr.length - 1) sb.append(","); }
            sb.append("]"); return sb.toString();
        }
        if (obj instanceof ListNode) {
            ListNode head = (ListNode) obj;
            StringBuilder sb = new StringBuilder("[");
            while (head != null) { sb.append(head.val); if (head.next != null) sb.append(","); head = head.next; }
            sb.append("]"); return sb.toString();
        }
        if (obj instanceof TreeNode) {
            TreeNode root = (TreeNode) obj;
            List<String> res = new ArrayList<>(); Queue<TreeNode> q = new LinkedList<>(); q.add(root);
            while (!q.isEmpty()) {
                TreeNode curr = q.poll();
                if (curr != null) { res.add(String.valueOf(curr.val)); q.add(curr.left); q.add(curr.right); } else res.add("null");
            }
            while (!res.isEmpty() && res.get(res.size() - 1).equals("null")) res.remove(res.size() - 1);
            return "[" + String.join(",", res) + "]";
        }
        return obj.toString();
    }
`
    },
    cpp: {
        imports: '#include <iostream>\n#include <vector>\n#include <string>\n#include <sstream>\n#include <algorithm>\n#include <queue>\nusing namespace std;',
        commonClasses: `
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
`,
        serializers: `
vector<int> parseVector(string s) {
    vector<int> res;
    if (s == "[]" || s == "null") return res;
    s = s.substr(1, s.length() - 2);
    stringstream ss(s); string item;
    while (getline(ss, item, ',')) {
        if (item == "null") res.push_back(-1e9);
        else res.push_back(stoi(item));
    }
    return res;
}
vector<string> parseStringVector(string s) {
    vector<string> res;
    if (s == "[]" || s == "null") return res;
    s = s.substr(1, s.length() - 2);
    stringstream ss(s); string item; bool inQuote = false; string current = "";
    for (char c : s) {
        if (c == '"') inQuote = !inQuote;
        else if (c == ',' && !inQuote) { if (!current.empty()) res.push_back(current); current = ""; }
        else if (inQuote) current += c;
    }
    if (!current.empty()) res.push_back(current);
    return res;
}
ListNode* listToLinkedList(vector<int> v) {
    if (v.empty()) return NULL;
    ListNode* head = new ListNode(v[0]); ListNode* curr = head;
    for (size_t i = 1; i < v.size(); i++) { curr->next = new ListNode(v[i]); curr = curr->next; }
    return head;
}
TreeNode* listToTree(vector<int> v) {
    if (v.empty() || v[0] == -1e9) return NULL;
    TreeNode* root = new TreeNode(v[0]); queue<TreeNode*> q; q.push(root); size_t i = 1;
    while (!q.empty() && i < v.size()) {
        TreeNode* curr = q.front(); q.pop();
        if (i < v.size() && v[i] != -1e9) { curr->left = new TreeNode(v[i]); q.push(curr->left); } i++;
        if (i < v.size() && v[i] != -1e9) { curr->right = new TreeNode(v[i]); q.push(curr->right); } i++;
    }
    return root;
}
string serialize(int v) { return to_string(v); }
string serialize(bool v) { return v ? "true" : "false"; }
string serialize(string v) { return "\"" + v + "\""; }
string serialize(vector<int> v) {
    string res = "[";
    for (size_t i = 0; i < v.size(); i++) { res += to_string(v[i]); if (i < v.size() - 1) res += ","; }
    res += "]"; return res;
}
string serialize(ListNode* head) {
    string res = "[";
    while (head) { res += to_string(head->val); if (head->next) res += ","; head = head->next; }
    res += "]"; return res;
}
string serialize(TreeNode* root) {
    if (!root) return "[]";
    string res = "["; queue<TreeNode*> q; q.push(root); vector<string> vals;
    while (!q.empty()) {
        TreeNode* curr = q.front(); q.pop();
        if (curr) { vals.push_back(to_string(curr->val)); q.push(curr->left); q.push(curr->right); } else vals.push_back("null");
    }
    while (!vals.empty() && vals.back() == "null") vals.pop_back();
    for (size_t i = 0; i < vals.size(); i++) { res += vals[i]; if (i < vals.size() - 1) res += ","; }
    res += "]"; return res;
}
`
    }
};

module.exports = ({ strapi }) => ({
    wrap(userCode, template, delimiter = '', problem = {}) {
        if (!template || !template.wrapperCode) {
            throw new Error(`Wrapper code missing for ${template?.language}`);
        }

        const language = template.language;
        const langBoilerplate = BOILERPLATE[language] || { imports: '', commonClasses: '', serializers: '' };
        const decodedUserCode = this.decode(userCode);
        const functionName = problem.functionName || 'solution';
        const params = problem.functionParams || [];

        let invocation = '';
        let paramAssignments = '';

        if (language === 'javascript') {
            invocation = `${functionName}(...paramValues)`;
            paramAssignments = `
    const lines = input.split('\\n').filter(l => l.trim());
    const paramValues = lines.map(l => JSON.parse(l));
`;
        } else if (language === 'python') {
            invocation = `${functionName}(*param_values)`;
            paramAssignments = `
    input_lines = sys.stdin.read().splitlines()
    param_values = [json.loads(line) for line in input_lines if line.strip()]
`;
        } else if (language === 'java') {
            const pm = params.map((p, i) => {
                const t = p.type.toLowerCase();
                if (t === 'int[]' || t === 'vector<int>') return `        int[] ${p.name} = parseArray(inputLines.get(${i}));`;
                if (t === 'string[]') return `        String[] ${p.name} = parseStringArray(inputLines.get(${i}));`;
                if (t === 'int') return `        int ${p.name} = Integer.parseInt(inputLines.get(${i}));`;
                if (t === 'listnode') return `        ListNode ${p.name} = listToLinkedList(parseArray(inputLines.get(${i})));`;
                if (t === 'treenode') return `        TreeNode ${p.name} = listToTree(parseArray(inputLines.get(${i})));`;
                return `        Object ${p.name} = inputLines.get(${i});`;
            }).join('\n');
            invocation = `sol.${functionName}(${params.map(p => p.name).join(', ')})`;
            paramAssignments = pm;
        } else if (language === 'cpp') {
            const pm = params.map((p, i) => {
                const t = p.type.toLowerCase();
                if (t === 'vector<int>') return `    vector<int> ${p.name} = parseVector(inputLines[${i}]);`;
                if (t === 'vector<string>') return `    vector<string> ${p.name} = parseStringVector(inputLines[${i}]);`;
                if (t === 'int') return `    int ${p.name} = stoi(inputLines[${i}]);`;
                if (t === 'listnode') return `    ListNode* ${p.name} = listToLinkedList(parseVector(inputLines[${i}]));`;
                if (t === 'treenode') return `    TreeNode* ${p.name} = listToTree(parseVector(inputLines[${i}]));`;
                return `    auto ${p.name} = inputLines[${i}];`;
            }).join('\n');
            invocation = `sol.${functionName}(${params.map(p => p.name).join(', ')})`;
            paramAssignments = pm;
        }

        return template.wrapperCode
            .replace(/{USER_CODE}/g, decodedUserCode)
            .replace(/{DELIMITER}/g, delimiter)
            .replace(/{IMPORTS}/g, langBoilerplate.imports)
            .replace(/{COMMON_CLASSES}/g, langBoilerplate.commonClasses)
            .replace(/{SERIALIZERS}/g, langBoilerplate.serializers)
            .replace(/{FUNCTION_NAME}/g, functionName)
            .replace(/{INVOCATION}/g, invocation)
            .replace(/{PARAM_ASSIGNMENTS}/g, paramAssignments);
    },

    decode(code) {
        if (!code) return '';
        return code.replace(/&#x2F;/g, '/').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");
    },

    prepareStdin(testCase, functionParams) {
        if (!functionParams || !Array.isArray(functionParams)) return '';
        return functionParams.map(param => {
            const val = testCase.input?.data?.[param.name] ?? testCase.input?.[param.name];
            return JSON.stringify(val !== undefined ? val : null);
        }).join('\n');
    }
});
