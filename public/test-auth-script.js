const API_BASE = "http://localhost:1337";

// Login function
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const identifier = document.getElementById("identifier").value;
  const password = document.getElementById("password").value;

  try {
    const response = await fetch(`${API_BASE}/api/auth/local`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identifier, password }),
      credentials: "include", // Important for HttpOnly cookies
    });

    const data = await response.json();

    if (response.ok) {
      document.getElementById("loginResult").innerHTML =
        `<div class="success">Login successful! Welcome ${data.user.username}</div>`;
      updateStatus();
    } else {
      document.getElementById("loginResult").innerHTML =
        `<div class="error">Login failed: ${data.error?.message || "Unknown error"}</div>`;
    }
  } catch (error) {
    document.getElementById("loginResult").innerHTML =
      `<div class="error">Error: ${error.message}</div>`;
  }
});

// Test authentication
async function testAuth() {
  try {
    const response = await fetch(`${API_BASE}/api/products/test-auth`, {
      credentials: "include", // Important for HttpOnly cookies
    });

    const data = await response.json();

    if (response.ok) {
      document.getElementById("testResult").innerHTML = `<div class="success">
                    <h3>Authentication Test Successful!</h3>
                    <pre>${JSON.stringify(data, null, 2)}</pre>
                </div>`;
    } else {
      document.getElementById("testResult").innerHTML =
        `<div class="error">Authentication failed: ${data.error?.message || "Not authenticated"}</div>`;
    }
  } catch (error) {
    document.getElementById("testResult").innerHTML =
      `<div class="error">Error: ${error.message}</div>`;
  }
}

// Get protected data
async function getProtectedData() {
  try {
    const response = await fetch(`${API_BASE}/api/products/protected-data`, {
      credentials: "include", // Important for HttpOnly cookies
    });

    const data = await response.json();

    if (response.ok) {
      document.getElementById("testResult").innerHTML = `<div class="success">
                    <h3>Protected Data Retrieved!</h3>
                    <pre>${JSON.stringify(data, null, 2)}</pre>
                </div>`;
    } else {
      document.getElementById("testResult").innerHTML =
        `<div class="error">Failed to get protected data: ${data.error?.message || "Not authenticated"}</div>`;
    }
  } catch (error) {
    document.getElementById("testResult").innerHTML =
      `<div class="error">Error: ${error.message}</div>`;
  }
}

// Logout function
async function logout() {
  try {
    const response = await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include", // Important for HttpOnly cookies
    });

    const data = await response.json();

    if (response.ok) {
      document.getElementById("testResult").innerHTML =
        `<div class="success">Logout successful!</div>`;
      updateStatus();
    } else {
      document.getElementById("testResult").innerHTML =
        `<div class="error">Logout failed: ${data.error?.message || "Unknown error"}</div>`;
    }
  } catch (error) {
    document.getElementById("testResult").innerHTML =
      `<div class="error">Error: ${error.message}</div>`;
  }
}

// Check current authentication status
async function updateStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: "include", // Important for HttpOnly cookies
    });

    if (response.ok) {
      const data = await response.json();
      document.getElementById("status").innerHTML = `<div class="success">
                    <strong>Status: Authenticated</strong><br>
                    User: ${data.user.username}<br>
                    Email: ${data.user.email}<br>
                    Role: ${data.user.role?.type || "No role"}
                </div>`;
    } else {
      document.getElementById("status").innerHTML =
        `<div class="info">Status: Not authenticated</div>`;
    }
  } catch (error) {
    document.getElementById("status").innerHTML =
      `<div class="error">Status: Error checking authentication</div>`;
  }
}

// Add event listeners to buttons
document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("testAuthBtn").addEventListener("click", testAuth);
  document
    .getElementById("getProtectedDataBtn")
    .addEventListener("click", getProtectedData);
  document.getElementById("logoutBtn").addEventListener("click", logout);

  // Check status on page load
  updateStatus();
});
