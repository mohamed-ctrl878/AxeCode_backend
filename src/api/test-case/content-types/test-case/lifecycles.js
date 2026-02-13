"use strict";

/**
 * Test Case Lifecycle Hooks
 * Validates test case input against problem's functionParams
 */

module.exports = {
  async beforeCreate(event) {
    await validateTestCase(event);
  },

  async beforeUpdate(event) {
    await validateTestCase(event);
  },
};

/**
 * Validates that test case input matches problem's functionParams
 * @param {Object} event - Strapi lifecycle event
 */
async function validateTestCase(event) {
  const { data } = event.params;

  // Skip if no input or no problem relation
  if (!data.input || !data.problem) {
    return;
  }

  // Get the problem to access functionParams
  const problemId =
    typeof data.problem === "object"
      ? data.problem.connect?.[0]?.id || data.problem.id
      : data.problem;

  if (!problemId) {
    return;
  }

  const problem = await strapi.documents("api::problem.problem").findOne({
    documentId: problemId,
    fields: ["functionParams", "functionName"],
  });

  if (!problem || !problem.functionParams) {
    return;
  }

  const functionParams = problem.functionParams;
  // Unwrap from the new { data: ... } structure
  const input = data.input?.data || data.input;

  if (!input || typeof input !== "object") {
     return; // Or throw if mandatory
  }
  
  // Validate each parameter exists in input
  const errors = [];

  for (const param of functionParams) {
    if (!(param.name in input)) {
      errors.push(`Missing required parameter: "${param.name}"`);
      continue;
    }

    const value = input[param.name];
    const expectedType = param.type.toLowerCase();

    // Type validation
    const typeError = validateParamType(param.name, value, expectedType);
    if (typeError) {
      errors.push(typeError);
    }
  }

  // Check for extra parameters not in functionParams
  const paramNames = functionParams.map((p) => p.name);
  for (const key of Object.keys(input)) {
    if (!paramNames.includes(key)) {
      errors.push(`Unexpected parameter: "${key}" is not defined in functionParams`);
    }
  }

  // Throw validation error if any issues found
  if (errors.length > 0) {
    throw new Error(`Test Case Validation Failed:\n${errors.join("\n")}`);
  }
}

/**
 * Validates a parameter value against its expected type
 * @param {string} name - Parameter name
 * @param {any} value - Parameter value
 * @param {string} expectedType - Expected type string
 * @returns {string|null} Error message or null if valid
 */
function validateParamType(name, value, expectedType) {
  // Handle array types: array<integer>, array<string>, etc.
  if (expectedType.startsWith("array<")) {
    if (!Array.isArray(value)) {
      return `Parameter "${name}" should be an array, got ${typeof value}`;
    }

    // Extract inner type: array<integer> -> integer
    const innerType = expectedType.slice(6, -1);

    // Validate each element
    for (let i = 0; i < value.length; i++) {
      if (value[i] === null) continue; // Allow nulls (for trees)

      const elementError = validatePrimitiveType(
        `${name}[${i}]`,
        value[i],
        innerType
      );
      if (elementError) {
        return elementError;
      }
    }
    return null;
  }

  // Handle matrix types: matrix<integer> (2D array)
  if (expectedType.startsWith("matrix<")) {
    if (!Array.isArray(value)) {
      return `Parameter "${name}" should be a matrix (2D array), got ${typeof value}`;
    }

    const innerType = expectedType.slice(7, -1);

    for (let i = 0; i < value.length; i++) {
      if (!Array.isArray(value[i])) {
        return `Parameter "${name}[${i}]" should be an array, got ${typeof value[i]}`;
      }

      for (let j = 0; j < value[i].length; j++) {
        const elementError = validatePrimitiveType(
          `${name}[${i}][${j}]`,
          value[i][j],
          innerType
        );
        if (elementError) {
          return elementError;
        }
      }
    }
    return null;
  }

  // Handle primitive types
  return validatePrimitiveType(name, value, expectedType);
}

/**
 * Validates primitive types
 */
function validatePrimitiveType(name, value, expectedType) {
  switch (expectedType) {
    case "integer":
    case "int":
      if (!Number.isInteger(value)) {
        return `Parameter "${name}" should be an integer, got ${typeof value}`;
      }
      break;

    case "float":
    case "double":
    case "number":
      if (typeof value !== "number") {
        return `Parameter "${name}" should be a number, got ${typeof value}`;
      }
      break;

    case "string":
      if (typeof value !== "string") {
        return `Parameter "${name}" should be a string, got ${typeof value}`;
      }
      break;

    case "boolean":
    case "bool":
      if (typeof value !== "boolean") {
        return `Parameter "${name}" should be a boolean, got ${typeof value}`;
      }
      break;

    case "listnode":
    case "linkedlist":
      // Linked lists are stored as arrays
      if (!Array.isArray(value)) {
        return `Parameter "${name}" should be an array (LinkedList format), got ${typeof value}`;
      }
      break;

    case "treenode":
    case "binarytree":
      // Binary trees are stored as level-order arrays with nulls
      if (!Array.isArray(value)) {
        return `Parameter "${name}" should be an array (BinaryTree BFS format), got ${typeof value}`;
      }
      break;
  }

  return null;
}
