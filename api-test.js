const axios = require('axios');

async function testApi() {
  try {
    const res = await axios.get('http://localhost:1338/api/users');
    console.log('API Status:', res.status);
  } catch (err) {
    console.log('API Error:', err.response ? err.response.status : err.message);
  }
}

testApi();
