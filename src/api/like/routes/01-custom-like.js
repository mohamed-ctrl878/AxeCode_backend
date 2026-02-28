module.exports = {
    routes: [
        {
            method: 'GET',
            path: '/likes/debug',
            handler: async (ctx) => {
                const likes = await strapi.documents('api::like.like').findMany({
                    populate: '*',
                    limit: 1000
                });
                ctx.send({ data: likes });
            },
            config: {
                auth: false,
            },
        },
    ],
};
