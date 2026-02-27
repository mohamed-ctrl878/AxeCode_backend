const strapi = require('@strapi/strapi');

strapi().start().then(async app => {
    try {
        const result = await app.documents('api::like.like').create({
            data: {
                content_types: 'blog',
                docId: '48',
                users_permissions_user: 'uz8iqakhfl73cwvid7lgs505'
            },
            populate: '*'
        });

        console.log("---- RESULT DB OUTPUT ----");
        console.log(JSON.stringify(result, null, 2));
        console.log("--------------------------");

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
});
