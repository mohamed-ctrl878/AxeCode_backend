
async function checkDB() {
  try {
    const entitlements = await strapi.documents('api::entitlement.entitlement').findMany({
      status: 'published'
    });
    console.log('--- Entitlements ---');
    console.log(JSON.stringify(entitlements, null, 2));

    const userEntitlements = await strapi.documents('api::user-entitlement.user-entitlement').findMany({
      populate: ['users_permissions_user']
    });
    console.log('--- User Entitlements ---');
    console.log(JSON.stringify(userEntitlements, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDB();
