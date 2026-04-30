
const fs = require('fs');

async function diagnose() {
  const report = { timestamp: new Date().toISOString(), logs: [] };
  
  try {
    // 1. Check all Entitlements
    const entitlements = await strapi.documents('api::entitlement.entitlement').findMany();
    report.entitlements = entitlements.map(e => ({ id: e.id, docId: e.documentId, itemId: e.itemId, type: e.content_types }));

    // 2. Check all User Entitlements (Ownerships)
    const ownerships = await strapi.documents('api::user-entitlement.user-entitlement').findMany({
      populate: ['users_permissions_user']
    });
    report.ownerships = ownerships.map(o => ({ 
      id: o.id, 
      productId: o.productId, 
      type: o.content_types,
      user: o.users_permissions_user?.username,
      userId: o.users_permissions_user?.id,
      userDocId: o.users_permissions_user?.documentId
    }));

    // 3. Check all Payments
    const payments = await strapi.documents('api::payment.payment').findMany({
      populate: ['user', 'course', 'event']
    });
    report.payments = payments.map(p => ({
      id: p.id,
      paymobId: p.paymob_id,
      status: p.status,
      user: p.user?.username,
      courseId: p.course?.documentId,
      eventId: p.event?.documentId
    }));

    fs.writeFileSync('scratch/db-report.json', JSON.stringify(report, null, 2));
    console.log('Diagnostic report generated in scratch/db-report.json');
    process.exit(0);
  } catch (err) {
    console.error(err);
    fs.writeFileSync('scratch/db-report-error.txt', err.message);
    process.exit(1);
  }
}

diagnose();
