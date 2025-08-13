const axios = require("axios");

const BASE_URL = "http://localhost:1338";

async function checkServer() {
  console.log("🔍 Checking server status...");
  console.log("=".repeat(50));

  try {
    // Check if server is running
    console.log("📡 Testing server connection...");
    const response = await axios.get(`${BASE_URL}/api/hello`, {
      timeout: 5000,
    });
    console.log("✅ Server is running!");
    console.log("Status:", response.status);
    console.log("Data:", response.data);

    // Test code execution endpoint
    console.log("\n🧪 Testing code execution endpoint...");
    const testRequest = {
      language: "cpp",
      code: "int add(int a, int b) { return a + b; }",
      functionName: "add",
      functionReturnType: "int",
      testCases: [
        {
          id: 1,
          inputs: [5, 3],
          inputTypes: ["int", "int"],
        },
      ],
      expected: [8],
    };

    const codeResponse = await axios.post(
      `${BASE_URL}/api/code-execution`,
      testRequest,
      { timeout: 10000 }
    );
    console.log("✅ Code execution endpoint is working!");
    console.log("Status:", codeResponse.status);
    console.log("Response structure:", Object.keys(codeResponse.data));

    if (codeResponse.data.results) {
      console.log(
        "Results found:",
        codeResponse.data.results.length,
        "test cases"
      );
      codeResponse.data.results.forEach((result, index) => {
        console.log(`  Test ${index + 1}:`, result);
      });
    } else {
      console.log("No results in response");
      console.log("Full response:", JSON.stringify(codeResponse.data, null, 2));
    }
  } catch (error) {
    console.log("❌ Server check failed:");
    console.log("Error:", error.message);

    if (error.code === "ECONNREFUSED") {
      console.log(
        "💡 Server is not running. Please start Strapi with: npm run develop"
      );
    } else if (error.code === "ENOTFOUND") {
      console.log("💡 Cannot resolve localhost. Check your network settings.");
    } else if (error.response) {
      console.log("Status:", error.response.status);
      console.log("Data:", error.response.data);
    }
  }
}

checkServer();
