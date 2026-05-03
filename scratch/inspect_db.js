
const strapi = require('@strapi/strapi');

async function checkTransactions() {
  const app = await strapi().load();
  
  try {
    console.log('--- Database Inspection ---');
    
    // Check total count
    const count = await app.db.query('api::transaction.transaction').count();
    console.log(`Total transactions in DB: ${count}`);
    
    // Check latest 5 transactions
    const latest = await app.db.query('api::transaction.transaction').findMany({
      limit: 5,
      orderBy: { createdAt: 'desc' },
      populate: ['wallet']
    });
    
    console.log('Latest 5 transactions details:');
    latest.forEach(t => {
      console.log(`ID: ${t.id}, Amount: ${t.amount}, Wallet linked: ${t.wallet ? t.wallet.id : 'NULL'}, CreatedAt: ${t.createdAt}`);
    });

    // Check raw table structure for one record if exists
    if (latest.length > 0) {
      const raw = await app.db.connection('transactions').where({ id: latest[0].id }).first();
      console.log('Raw DB record columns:', Object.keys(raw));
    }

  } catch (err) {
    console.error('Inspection failed:', err);
  } finally {
    process.exit(0);
  }
}

checkTransactions();
