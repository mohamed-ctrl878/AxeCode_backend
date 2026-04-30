const { Client } = require('pg');
const axios = require('axios');

const client = new Client({
  user: 'postgres',
  host: '127.0.0.1',
  database: 'postgres',
  password: '0194456244',
  port: 5432
});

const strapiAPI = 'http://localhost:1338/api';
let orderId = Math.floor(Math.random() * 100000000).toString();
let userId, userDocId, courseDocId;

async function runTest() {
  try {
    await client.connect();

    console.log('[1] Fetching target user and course...');
    const users = await client.query('SELECT id, document_id FROM up_users LIMIT 1');
    const courses = await client.query('SELECT id, document_id FROM courses LIMIT 1');
    
    if (!users.rows.length || !courses.rows.length) {
      console.log('❌ Missing users or courses in the database.');
      return;
    }

    userId = users.rows[0].id;
    userDocId = users.rows[0].document_id;
    courseDocId = courses.rows[0].document_id;
    
    console.log(`Using User: ${userDocId}, Course: ${courseDocId}`);

    // Wait, let's use the local API via a Strapi instance script instead of raw SQL inserts.
    // If we use raw SQL, we have to handle Strapi's relations table which is complex.
    // Let's create an HTTP endpoint strictly for testing, or just write a small Node script 
    // that uses the standard fetch API with a JWT.
    
    // Actually, I can just create a Strapi script locally to bootstrap Strapi and insert the document.
    // But since Strapi is already running on port 1338, we can't bootstrap it again easily.
    console.log('[2] Let\'s test via Strapi context...');

  } catch (error) {
    console.error('Test Failed:', error);
  } finally {
    await client.end();
  }
}

runTest();
