
const strapi = require('@strapi/strapi');

async function fixLinks() {
  const app = await strapi().load();
  try {
    console.log('Fixing transaction links...');
    
    // Find all transactions without a wallet
    const transactions = await app.db.query('api::transaction.transaction').findMany({
      populate: ['wallet']
    });

    const unlinked = transactions.filter(t => !t.wallet);
    console.log(`Found ${unlinked.length} unlinked transactions.`);

    for (const t of unlinked) {
      // Based on our investigation, Wallet ID 2 is the main publisher wallet
      // We will link CREDIT transactions that look like course purchases to it
      if (t.type === 'CREDIT' && t.description.includes('course purchase')) {
        await app.documents('api::transaction.transaction').update({
          documentId: t.documentId,
          data: { wallet: 2 }
        });
        console.log(`Linked Transaction #${t.id} to Wallet #2`);
      }
    }
  } catch (err) {
    console.error('Fix failed:', err);
  } finally {
    process.exit(0);
  }
}

fixLinks();
