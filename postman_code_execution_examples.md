# Code Execution API - Postman Examples

## Base URL

```
http://localhost:1337/api/code-execution
```

## Headers

```
Content-Type: application/json
```

---

## Example 1: Simple Addition Function

### Request

```json
{
  "language": "cpp",
  "code": "int add(int a, int b) { return a + b; }",
  "functionName": "add",
  "functionReturnType": "int",
  "testCases": [
    {
      "inputs": [5, 3],
      "inputTypes": ["int", "int"]
    },
    {
      "inputs": [10, 20],
      "inputTypes": ["int", "int"]
    },
    {
      "inputs": [-5, 8],
      "inputTypes": ["int", "int"]
    }
  ],
  "expected": [8, 30, 3]
}
```

---

## Example 2: Vector Sum Function

### Request

```json
{
  "language": "cpp",
  "code": "int sum(vector<int>& nums) { int total = 0; for(int num : nums) total += num; return total; }",
  "functionName": "sum",
  "functionReturnType": "int",
  "testCases": [
    {
      "inputs": [[1, 2, 3, 4, 5]],
      "inputTypes": ["vector<int>"]
    },
    {
      "inputs": [[10, 20, 30]],
      "inputTypes": ["vector<int>"]
    }
  ],
  "expected": [15, 60]
}
```

---

## Example 3: String Reverse Function

### Request

```json
{
  "language": "cpp",
  "code": "string reverse(string s) { reverse(s.begin(), s.end()); return s; }",
  "functionName": "reverse",
  "functionReturnType": "string",
  "testCases": [
    {
      "inputs": ["hello"],
      "inputTypes": ["string"]
    },
    {
      "inputs": ["world"],
      "inputTypes": ["string"]
    }
  ],
  "expected": ["olleh", "dlrow"]
}
```

---

## Example 4: Find Maximum in Vector

### Request

```json
{
  "language": "cpp",
  "code": "int findMax(vector<int>& nums) { if(nums.empty()) return -1; return *max_element(nums.begin(), nums.end()); }",
  "functionName": "findMax",
  "functionReturnType": "int",
  "testCases": [
    {
      "inputs": [[3, 7, 2, 9, 1]],
      "inputTypes": ["vector<int>"]
    },
    {
      "inputs": [[5, 2, 8, 4]],
      "inputTypes": ["vector<int>"]
    }
  ],
  "expected": [9, 8]
}
```

---

## Example 5: Binary Tree Traversal (Inorder)

### Request

```json
{
  "language": "cpp",
  "code": "TreeNode* buildTree(vector<int>& values, int& index) { if(index >= values.size() || values[index] == -1) { index++; return nullptr; } TreeNode* root = new TreeNode(values[index++]); root->left = buildTree(values, index); root->right = buildTree(values, index); return root; } vector<int> inorderTraversal(TreeNode* root) { vector<int> result; function<void(TreeNode*)> inorder = [&](TreeNode* node) { if(!node) return; inorder(node->left); result.push_back(node->val); inorder(node->right); }; inorder(root); return result; }",
  "functionName": "inorderTraversal",
  "functionReturnType": "vector<int>",
  "testCases": [
    {
      "inputs": [[1, -1, 2, 3]],
      "inputTypes": ["TreeNode*"]
    }
  ],
  "expected": [[1, 3, 2]]
}
```

---

## Example 6: Palindrome Check

### Request

```json
{
  "language": "cpp",
  "code": "bool isPalindrome(string s) { string cleaned; for(char c : s) { if(isalnum(c)) cleaned += tolower(c); } string reversed = cleaned; reverse(reversed.begin(), reversed.end()); return cleaned == reversed; }",
  "functionName": "isPalindrome",
  "functionReturnType": "bool",
  "testCases": [
    {
      "inputs": ["A man, a plan, a canal: Panama"],
      "inputTypes": ["string"]
    },
    {
      "inputs": ["race a car"],
      "inputTypes": ["string"]
    }
  ],
  "expected": [true, false]
}
```

---

## Example 7: Two Sum Problem

### Request

```json
{
  "language": "cpp",
  "code": "vector<int> twoSum(vector<int>& nums, int target) { unordered_map<int, int> seen; for(int i = 0; i < nums.size(); i++) { int complement = target - nums[i]; if(seen.find(complement) != seen.end()) { return {seen[complement], i}; } seen[nums[i]] = i; } return {}; }",
  "functionName": "twoSum",
  "functionReturnType": "vector<int>",
  "testCases": [
    {
      "inputs": [[2, 7, 11, 15], 9],
      "inputTypes": ["vector<int>", "int"]
    },
    {
      "inputs": [[3, 2, 4], 6],
      "inputTypes": ["vector<int>", "int"]
    }
  ],
  "expected": [
    [0, 1],
    [1, 2]
  ]
}
```

---

## Example 8: Fibonacci Number

### Request

```json
{
  "language": "cpp",
  "code": "int fib(int n) { if(n <= 1) return n; int prev = 0, curr = 1; for(int i = 2; i <= n; i++) { int next = prev + curr; prev = curr; curr = next; } return curr; }",
  "functionName": "fib",
  "functionReturnType": "int",
  "testCases": [
    {
      "inputs": [4],
      "inputTypes": ["int"]
    },
    {
      "inputs": [6],
      "inputTypes": ["int"]
    }
  ],
  "expected": [3, 8]
}
```

---

## Example 9: Valid Parentheses

### Request

```json
{
  "language": "cpp",
  "code": "bool isValid(string s) { stack<char> st; for(char c : s) { if(c == '(' || c == '{' || c == '[') { st.push(c); } else { if(st.empty()) return false; char top = st.top(); st.pop(); if((c == ')' && top != '(') || (c == '}' && top != '{') || (c == ']' && top != '[')) return false; } } return st.empty(); }",
  "functionName": "isValid",
  "functionReturnType": "bool",
  "testCases": [
    {
      "inputs": ["()"],
      "inputTypes": ["string"]
    },
    {
      "inputs": ["()[]{}"],
      "inputTypes": ["string"]
    },
    {
      "inputs": ["(]"],
      "inputTypes": ["string"]
    }
  ],
  "expected": [true, true, false]
}
```

---

## Example 10: Merge Sorted Arrays

### Request

```json
{
  "language": "cpp",
  "code": "vector<int> merge(vector<int>& nums1, vector<int>& nums2) { vector<int> result; int i = 0, j = 0; while(i < nums1.size() && j < nums2.size()) { if(nums1[i] <= nums2[j]) { result.push_back(nums1[i]); i++; } else { result.push_back(nums2[j]); j++; } } while(i < nums1.size()) { result.push_back(nums1[i]); i++; } while(j < nums2.size()) { result.push_back(nums2[j]); j++; } return result; }",
  "functionName": "merge",
  "functionReturnType": "vector<int>",
  "testCases": [
    {
      "inputs": [
        [1, 3, 5],
        [2, 4, 6]
      ],
      "inputTypes": ["vector<int>", "vector<int>"]
    }
  ],
  "expected": [[1, 2, 3, 4, 5, 6]]
}
```

---

## Example 11: Reverse Linked List

### Request

```json
{
  "language": "cpp",
  "code": "ListNode* reverseList(ListNode* head) { ListNode* prev = nullptr; ListNode* current = head; while (current != nullptr) { ListNode* next = current->next; current->next = prev; prev = current; current = next; } return prev; }",
  "functionName": "reverseList",
  "functionReturnType": "ListNode*",
  "testCases": [
    {
      "inputs": [[1, 2, 3, 4, 5]],
      "inputTypes": ["ListNode*"]
    },
    {
      "inputs": [[1, 2]],
      "inputTypes": ["ListNode*"]
    }
  ],
  "expected": [
    [5, 4, 3, 2, 1],
    [2, 1]
  ]
}
```

---

## Example 12: Remove Nth Node From End

### Request

```json
{
  "language": "cpp",
  "code": "ListNode* removeNthFromEnd(ListNode* head, int n) { ListNode* dummy = new ListNode(0); dummy->next = head; ListNode* first = dummy; ListNode* second = dummy; for (int i = 0; i <= n; i++) { first = first->next; } while (first != nullptr) { first = first->next; second = second->next; } second->next = second->next->next; return dummy->next; }",
  "functionName": "removeNthFromEnd",
  "functionReturnType": "ListNode*",
  "testCases": [
    {
      "inputs": [[1, 2, 3, 4, 5], 2],
      "inputTypes": ["ListNode*", "int"]
    }
  ],
  "expected": [[1, 2, 3, 5]]
}
```

---

## Example 13: Merge Two Sorted Lists

### Request

```json
{
  "language": "cpp",
  "code": "ListNode* mergeTwoLists(ListNode* l1, ListNode* l2) { ListNode* dummy = new ListNode(0); ListNode* current = dummy; while (l1 != nullptr && l2 != nullptr) { if (l1->val <= l2->val) { current->next = l1; l1 = l1->next; } else { current->next = l2; l2 = l2->next; } current = current->next; } if (l1 != nullptr) current->next = l1; if (l2 != nullptr) current->next = l2; return dummy->next; }",
  "functionName": "mergeTwoLists",
  "functionReturnType": "ListNode*",
  "testCases": [
    {
      "inputs": [
        [1, 2, 4],
        [1, 3, 4]
      ],
      "inputTypes": ["ListNode*", "ListNode*"]
    }
  ],
  "expected": [[1, 1, 2, 3, 4, 4]]
}
```

---

## Error Test Cases

### 1. Invalid Language

```json
{
  "language": "python",
  "code": "print('hello')",
  "functionName": "main",
  "functionReturnType": "void",
  "testCases": [],
  "expected": []
}
```

### 2. Empty Code

```json
{
  "language": "cpp",
  "code": "",
  "functionName": "test",
  "functionReturnType": "int",
  "testCases": [],
  "expected": []
}
```

### 3. Mismatched Test Cases and Expected

```json
{
  "language": "cpp",
  "code": "int add(int a, int b) { return a + b; }",
  "functionName": "add",
  "functionReturnType": "int",
  "testCases": [
    {
      "inputs": [1, 2],
      "inputTypes": ["int", "int"]
    }
  ],
  "expected": [3, 5]
}
```

### 4. Invalid Input Types

```json
{
  "language": "cpp",
  "code": "int test(int a) { return a; }",
  "functionName": "test",
  "functionReturnType": "int",
  "testCases": [
    {
      "inputs": ["not_a_number"],
      "inputTypes": ["int"]
    }
  ],
  "expected": [0]
}
```

---

## Expected Response Format

### Success Response

```json
{
  "compileError": null,
  "results": [
    "{Output: 8, Input: [5,3], Time: 45 microseconds, Expected: 8}",
    "{Output: 30, Input: [10,20], Time: 23 microseconds, Expected: 30}"
  ]
}
```

### Error Response

```json
{
  "compileError": "Compilation error: error: 'add' was not declared in this scope",
  "results": []
}
```

### Validation Error Response

```json
{
  "error": {
    "message": "Validation errors:\nTest case 1, Input 1: Invalid input type or value for int."
  }
}
```

---

## Postman Collection Setup

1. **Create a new collection** called "Code Execution API"
2. **Set environment variables:**
   - `base_url`: `http://localhost:1337`
   - `api_endpoint`: `/api/code-execution`
3. **Import the examples above** as separate requests
4. **Test with different scenarios** to verify all functionality

---

## Testing Tips

1. **Start with simple examples** like Example 1
2. **Test error cases** to ensure proper validation
3. **Check timeout behavior** with complex algorithms
4. **Verify output formatting** matches expected format
5. **Test with different data types** to ensure compatibility
