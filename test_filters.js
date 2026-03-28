const strapi = require('@strapi/strapi');

(async () => {
    const app = await strapi().load();
    
    // Test 1: Count all
    const all = await app.db.query('api::submission.submission').count();
    console.log("Total submissions in DB:", all);

    // Test 2: document API with user object format
    const docQuery = await app.documents('api::submission.submission').findMany({
        filters: {}
    });
    console.log("All from doc API:", docQuery.length, docQuery[0]);

    if (docQuery.length > 0) {
        const sub = docQuery[0];
        console.log("Relations of first sub:", await app.db.query('api::submission.submission').findOne({
            where: { id: sub.id },
            populate: ['user', 'problem']
        }));
    }

    process.exit(0);
})();
