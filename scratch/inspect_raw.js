
const knex = require('knex')({
  client: 'pg',
  connection: {
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: '0194456244',
    database: 'postgres',
    ssl: false
  }
});

async function inspectRaw() {
  try {
    console.log('--- Raw DB Inspection (Knex) ---');
    
    // Check tables
    const tables = await knex.raw("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
    // console.log('Tables:', tables.rows.map(t => t.tablename));

    const transTable = 'transactions';
    const hasTable = tables.rows.some(t => t.tablename === transTable);
    
    if (hasTable) {
      const count = await knex(transTable).count();
      console.log(`Total transactions in '${transTable}' table: ${count[0].count}`);
      
      const latest = await knex(transTable).orderBy('created_at', 'desc').limit(5);
      console.log('Latest 5 transactions:');
      latest.forEach(t => {
        // Look for wallet columns
        const walletCols = Object.keys(t).filter(k => k.includes('wallet'));
        console.log(`ID: ${t.id}, Amount: ${t.amount}, Type: ${t.type}, WalletCols:`, walletCols.map(k => `${k}=${t[k]}`).join(', '));
      });

      // Also check the links table if it's Strapi 5 many-to-many or something
      const linkTables = tables.rows.filter(t => t.tablename.includes('transactions_wallet_links'));
      if (linkTables.length > 0) {
        console.log('Found link table:', linkTables[0].tablename);
        const links = await knex(linkTables[0].tablename).select('*').limit(5);
        console.log('Links:', links);
      }
    } else {
      console.log(`Table '${transTable}' NOT found!`);
    }

  } catch (err) {
    console.error('Knex Error:', err);
  } finally {
    await knex.destroy();
    process.exit(0);
  }
}

inspectRaw();
