// Console test functions for HttpOnly cookies authentication

const API_BASE = "http://localhost:1337";

// Test login
async function testLogin(email = "test@example.com", password = "password123") {
  console.log("🔐 Testing login...");

  try {
    const response = await fetch(`${API_BASE}/api/auth/local`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identifier: email, password }),
      credentials: "include",
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Login successful!", data);
      return data;
    } else {
      console.log("❌ Login failed:", data);
      return null;
    }
  } catch (error) {
    console.log("❌ Error:", error);
    return null;
  }
}

// Test authentication
async function testAuth() {
  console.log("🔍 Testing authentication...");

  try {
    const response = await fetch(`${API_BASE}/api/products/test-auth`, {
      credentials: "include",
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Authentication successful!", data);
      return data;
    } else {
      console.log("❌ Authentication failed:", data);
      return null;
    }
  } catch (error) {
    console.log("❌ Error:", error);
    return null;
  }
}

// Get protected data
async function getProtectedData() {
  console.log("📊 Getting protected data...");

  try {
    const response = await fetch(`${API_BASE}/api/products/protected-data`, {
      credentials: "include",
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Protected data retrieved!", data);
      return data;
    } else {
      console.log("❌ Failed to get protected data:", data);
      return null;
    }
  } catch (error) {
    console.log("❌ Error:", error);
    return null;
  }
}

// Check authentication status
async function checkAuthStatus() {
  console.log("🔍 Checking authentication status...");

  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      console.log("✅ Authenticated:", data);
      return data;
    } else {
      console.log("❌ Not authenticated");
      return null;
    }
  } catch (error) {
    console.log("❌ Error:", error);
    return null;
  }
}

// Test logout
async function testLogout() {
  console.log("🚪 Testing logout...");

  try {
    const response = await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Logout successful!", data);
      return data;
    } else {
      console.log("❌ Logout failed:", data);
      return null;
    }
  } catch (error) {
    console.log("❌ Error:", error);
    return null;
  }
}

// Check cookies (should not be accessible via JavaScript)
function checkCookies() {
  console.log("🍪 Checking cookies...");
  const cookies = document.cookie;

  if (cookies) {
    console.log("🔍 Visible cookies:", cookies);
  } else {
    console.log("🔒 No cookies visible (HttpOnly protection working!)");
  }

  // Try to access JWT cookie specifically
  const jwtCookie = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith("jwt="));
  if (jwtCookie) {
    console.log(
      "⚠️  JWT cookie is accessible via JavaScript (security issue!)"
    );
  } else {
    console.log("✅ JWT cookie is not accessible via JavaScript (secure!)");
  }
}

// Full test sequence
async function runFullTest() {
  console.log("🚀 Starting full HttpOnly cookies test...\n");

  // Check initial status
  await checkAuthStatus();
  checkCookies();

  console.log("\n--- Step 1: Login ---");
  const loginResult = await testLogin();

  if (loginResult) {
    console.log("\n--- Step 2: Check cookies after login ---");
    checkCookies();

    console.log("\n--- Step 3: Test authentication ---");
    await testAuth();

    console.log("\n--- Step 4: Get protected data ---");
    await getProtectedData();

    console.log("\n--- Step 5: Check auth status ---");
    await checkAuthStatus();

    console.log("\n--- Step 6: Logout ---");
    await testLogout();

    console.log("\n--- Step 7: Check cookies after logout ---");
    checkCookies();

    console.log("\n--- Step 8: Final auth status ---");
    await checkAuthStatus();
  }

  console.log("\n🎉 Full test completed!");
}

// Make functions available globally
window.testLogin = testLogin;
window.testAuth = testAuth;
window.getProtectedData = getProtectedData;
window.checkAuthStatus = checkAuthStatus;
window.testLogout = testLogout;
window.checkCookies = checkCookies;
window.runFullTest = runFullTest;

console.log("🍪 HttpOnly Cookies Test Functions Loaded!");
console.log("Available functions:");
console.log("- testLogin(email, password)");
console.log("- testAuth()");
console.log("- getProtectedData()");
console.log("- checkAuthStatus()");
console.log("- testLogout()");
console.log("- checkCookies()");
console.log("- runFullTest()");
console.log("\nTry running: runFullTest()");
