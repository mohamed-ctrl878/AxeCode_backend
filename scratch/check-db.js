
const Database = require('better-sqlite3');
const db = new Database('.tmp/data.db');

try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables:', tables.map(t => t.name).join(', '));

    const walletTables = tables.filter(t => t.name.toLowerCase().includes('wallet'));
    console.log('Wallet related tables:', walletTables.map(t => t.name).join(', '));

    const transactionTables = tables.filter(t => t.name.toLowerCase().includes('transaction'));
    console.log('Transaction related tables:', transactionTables.map(t => t.name).join(', '));

    const payoutTables = tables.filter(t => t.name.toLowerCase().includes('payout'));
    console.log('Payout related tables:', payoutTables.map(t => t.name).join(', '));


} catch (err) {
    console.error('Error:', err.message);
}
