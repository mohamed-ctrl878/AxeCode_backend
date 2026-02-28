"use strict";

const strapi = require("@strapi/strapi");

strapi().start().then(async app => {
    try {
        const facade = app.service('api::rate.interaction-facade');
        console.log("Testing isLikedByMe lookup...");

        const metadata = await facade.getMetadata('blog', 'b9duxe32b12cy2lzafmuojfl', 'uz8iqakhfl73cwvid7lgs505');

        console.log("Metadata Result:", JSON.stringify(metadata, null, 2));

    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}).catch(console.error);
