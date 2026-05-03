
const knex = require('knex')({
  client: 'pg',
  connection: 'postgres://postgres:0194456244@127.0.0.1:5432/postgres'
});

async function run() {
  try {
    const rows = await knex('transactions').orderBy('id', 'desc').limit(10);
    console.log('LATEST_TRANSACTIONS_START');
    console.log(JSON.stringify(rows, null, 2));
    console.log('LATEST_TRANSACTIONS_END');
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await knex.destroy();
    process.exit(0);
  }
}
run();
