
async function fixOwnership() {
  try {
    const userDocId = 'uz8iqakhfl73cwvid7lgs505'; // memo
    const entitlementDocId = 'fzwixyo7gr2avqq9p36yla94'; // The course he bought
    const contentType = 'course';

    console.log(`Fixing ownership for user ${userDocId} and entitlement ${entitlementDocId}`);

    await strapi.documents('api::user-entitlement.user-entitlement').create({
      data: {
        productId: entitlementDocId,
        content_types: contentType,
        users_permissions_user: userDocId,
        publishedAt: new Date()
      },
      status: 'published'
    });

    console.log('Ownership fixed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Fix failed:', err);
    process.exit(1);
  }
}

fixOwnership();
