const { Client } = require('pg');
const client = new Client({
  user: 'postgres',
  host: '127.0.0.1',
  database: 'postgres',
  password: '0194456244',
  port: 5432
});

client.connect()
  .then(() => client.query('SELECT id, email, username FROM up_users LIMIT 5'))
  .then(res => {
    console.log(res.rows);
    return client.query('SELECT document_id as "documentId" FROM up_users LIMIT 5');
  })
  .then(res => {
    console.log("Document IDs:", res.rows);
    return client.query('SELECT document_id as "documentId", id FROM courses LIMIT 1');
  })
  .then(res => {
    console.log("Course IDs:", res.rows);
    client.end();
  })
  .catch(err => {
    console.error(err);
    client.end();
  });
