const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '0194456244',
});

async function dumpConfig() {
  await client.connect();
  const res = await client.query("SELECT key, value FROM strapi_core_store_settings WHERE key = 'plugin_content_manager_configuration_content_types::api::test-case.test-case'");
  if (res.rows[0]) {
      console.log(JSON.stringify(JSON.parse(res.rows[0].value), null, 2));
  } else {
      console.log('Config not found');
  }
  await client.end();
}
dumpConfig();
