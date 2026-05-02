
const strapi = require('@strapi/strapi');

async function check() {
    const app = await strapi().load();
    const knex = app.db.connection;

    try {
        const tables = await knex.raw("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
        const tableNames = tables.rows.map(t => t.tablename);
        console.log('Tables:', tableNames.join(', '));

        const walletRelated = tableNames.filter(t => t.includes('wallet'));
        console.log('Wallet related:', walletRelated);

        const txRelated = tableNames.filter(t => t.includes('transaction'));
        console.log('Transaction related:', txRelated);

        const payoutRelated = tableNames.filter(t => t.includes('payout'));
        console.log('Payout related:', payoutRelated);

        if (tableNames.includes('transactions')) {
            const count = await knex('transactions').count();
            console.log('Transaction count:', count);
            const sample = await knex('transactions').select('*').limit(5);
            console.log('Sample transactions:', sample);
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit(0);
    }
}

check();
