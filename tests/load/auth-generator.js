'use strict';

const tokenCache = new Map();
let tokenCounter = 0;

/**
 * Generates an auth token using native fetch (Node 18+)
 */
async function generateAuthToken(requestParams, ctx) {
  tokenCounter++;
  if (!ctx.vars) ctx.vars = {};
  
  const testUsers = [
    { identifier: 'loadtest1@axecode.com', password: 'LoadTest123!' },
    { identifier: 'loadtest2@axecode.com', password: 'LoadTest123!' },
    { identifier: 'loadtest3@axecode.com', password: 'LoadTest123!' },
  ];

  const user = testUsers[tokenCounter % testUsers.length];

  if (tokenCache.has(user.identifier)) {
    ctx.vars.jwt = tokenCache.get(user.identifier);
    return;
  }

  try {
    const response = await fetch('http://localhost:1338/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    if (response.ok) {
      const data = await response.json();
      tokenCache.set(user.identifier, data.jwt);
      ctx.vars.jwt = data.jwt;
    } else {
      ctx.vars.jwt = 'artillery-test-token';
    }
  } catch (err) {
    ctx.vars.jwt = 'artillery-error-token';
  }
}

module.exports = {
  generateAuthToken,
};
