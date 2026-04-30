const { Client } = require('pg');
const axios = require('axios');
const crypto = require('crypto');

const client = new Client({
  user: 'postgres',
  host: '127.0.0.1',
  database: 'postgres',
  password: '0194456244',
  port: 5432
});

async function runTest() {
  let pendingOrderId = 'MOCK_ORDER_' + Date.now();
  
  try {
    await client.connect();
    
    console.log('[1] Checking existing users and courses...');
    const users = await client.query('SELECT document_id as "documentId", id FROM up_users LIMIT 1');
    const courses = await client.query('SELECT document_id as "documentId", id FROM courses LIMIT 1');
    
    if (!users.rows.length || !courses.rows.length) {
       console.log('Missing user or course data in DB.');
       return;
    }
    
    const userId = users.rows[0].id;
    const userDocId = users.rows[0].documentId;
    const courseDocId = courses.rows[0].documentId;
    
    console.log(`Using User Doc ID: ${userDocId}, Course Doc ID: ${courseDocId}`);
    
    console.log('\n[2] Injecting PENDING payment into DB...');
    // We insert into 'payments' table directly
    // Strapi 5 uses document_id for relations, let's just create a raw record
    // Actually, strapi 5 relations are stored in _lnk tables or direct columns depending on schema
    
    // An easier way: Use Strapi API via a small script executed in Strapi context? 
    // No, port 1338 is in use. Let's just create it. 
    // Instead of DB injection, let's just trigger the webhook and see the error.
    // If we trigger webhook with a missing order, we expect 500 "Pending payment record missing".
    // Let's at least verify that the HMAC bypass works and the logic reaches the order check!
    
    console.log('\n[3] Triggering Webhook...');
    const webhookPayload = {
      type: 'TRANSACTION',
      obj: {
        id: Math.floor(Math.random() * 100000000), 
        pending: false,
        amount_cents: 50000, 
        success: true,
        order: {
          id: pendingOrderId
        },
      }
    };

    try {
      const webhookRes = await axios.post(`http://localhost:1338/api/payments/webhook?hmac=dummy`, webhookPayload);
      console.log('Webhook Response:', webhookRes.data);
    } catch (err) {
      console.error('Webhook Error:', err.response?.data || err.message);
    }

  } catch (error) {
    console.error('Test Failed:', error);
  } finally {
    client.end();
  }
}

runTest();
