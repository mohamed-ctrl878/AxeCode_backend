const API_BASE = "http://localhost:1337";

function showResult(message, type = "info") {
  document.getElementById("result").innerHTML =
    `<div class="result ${type}">${message}</div>`;
}

async function testLogin() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  showResult("Testing login...", "info");

  try {
    const response = await fetch(`${API_BASE}/api/auth/local`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: email,
        password: password,
      }),
      credentials: "include",
    });

    const data = await response.json();

    if (response.ok) {
      showResult(
        `✅ Login successful! Welcome ${data.user.username}`,
        "success"
      );
    } else {
      showResult(
        `❌ Login failed: ${data.error?.message || "Check credentials"}`,
        "error"
      );
    }
  } catch (error) {
    showResult(`❌ Error: ${error.message}`, "error");
  }
}

async function testAuth() {
  showResult("Testing authentication...", "info");

  try {
    const response = await fetch(`${API_BASE}/api/products/test-auth`, {
      credentials: "include",
    });

    const data = await response.json();

    if (response.ok) {
      showResult(
        `✅ Authentication successful! User: ${data.user.username}`,
        "success"
      );
    } else {
      showResult(
        `❌ Authentication failed: ${data.error?.message || "Not authenticated"}`,
        "error"
      );
    }
  } catch (error) {
    showResult(`❌ Error: ${error.message}`, "error");
  }
}

async function testLogout() {
  showResult("Testing logout...", "info");

  try {
    const response = await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    const data = await response.json();

    if (response.ok) {
      showResult("✅ Logout successful!", "success");
    } else {
      showResult(
        `❌ Logout failed: ${data.error?.message || "Unknown error"}`,
        "error"
      );
    }
  } catch (error) {
    showResult(`❌ Error: ${error.message}`, "error");
  }
}

function checkCookies() {
  const cookies = document.cookie;
  if (cookies) {
    showResult(`🔍 Visible cookies: ${cookies}`, "info");
  } else {
    showResult(
      "🔒 No cookies visible (HttpOnly protection working!)",
      "success"
    );
  }
}

// Add event listeners when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  // Add click event listeners to buttons
  document.getElementById("testLoginBtn").addEventListener("click", testLogin);
  document.getElementById("testAuthBtn").addEventListener("click", testAuth);
  document
    .getElementById("testLogoutBtn")
    .addEventListener("click", testLogout);
  document
    .getElementById("checkCookiesBtn")
    .addEventListener("click", checkCookies);

  // Auto-check cookies on page load
  checkCookies();
});
