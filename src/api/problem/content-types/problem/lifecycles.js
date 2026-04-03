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

    // Generate templates for all supported languages
    for (const lang of ['python', 'java', 'javascript', 'cpp']) {
      const language = lang;
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
              problem: documentId,
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
  return `{IMPORTS}
{COMMON_CLASSES}

# ==== USER CODE ====
{USER_CODE}
# ==== END ====

if __name__ == "__main__":
    {PARAM_ASSIGNMENTS}
    {SERIALIZERS}
    
    # Separation Logic
    print("\\n{DELIMITER}")
    
    result = {INVOCATION}
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
  return `{COMMON_CLASSES}

// ==== USER CODE ====
{USER_CODE}
// ==== END ====

let input = '';
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
    {PARAM_ASSIGNMENTS}
    {SERIALIZERS}
    
    // Separation Logic
    console.log("\\n{DELIMITER}");
    
    const result = {INVOCATION};
    console.log(JSON.stringify(serialize(result)));
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
  return `{IMPORTS}
{COMMON_CLASSES}

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
        
        // Separation Logic
        System.out.println("\\n{DELIMITER}");
        
        {PARAM_ASSIGNMENTS}
        Object result = {INVOCATION};
        System.out.println(serialize(result));
    }

    {SERIALIZERS}
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
  return `{IMPORTS}
{COMMON_CLASSES}

{SERIALIZERS}

// User Solution
{USER_CODE}

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
