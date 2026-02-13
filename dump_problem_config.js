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
  const res = await client.query("SELECT value FROM strapi_core_store_settings WHERE key = 'plugin_content_manager_configuration_content_types::api::problem.problem'");
  const config = JSON.parse(res.rows[0].value);
  console.log('Settings:', config.settings);
  await client.end();
}
dumpConfig();
