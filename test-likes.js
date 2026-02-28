const strapi = require('@strapi/strapi');
strapi().start().then(async app => {
    try {
        const likes = await app.documents('api::like.like').findMany({
            populate: ['users_permissions_user'],
            limit: 5
        });
        console.log(JSON.stringify(likes, null, 2));
    } catch (e) { console.error(e) }
    process.exit(0);
});
