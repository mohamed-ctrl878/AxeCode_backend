fetch('http://localhost:1338/api/users/me', {
  method: 'OPTIONS',
  headers: {
    'Origin': 'http://localhost:5173',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'Authorization, Content-Type'
  }
}).then(async r => {
  console.log('Status: ', r.status);
  console.log('Headers: ', Object.fromEntries(r.headers.entries()));
  console.log('Body: ', await r.text());
}).catch(e => console.error(e));
