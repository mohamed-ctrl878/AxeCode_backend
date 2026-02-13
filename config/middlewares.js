module.exports = [
  { name: "global::security-pipeline" },
  { name: "global::jwt-cookie" },
  "strapi::logger",
  "strapi::errors",
  "strapi::security",
  {
    name: "strapi::cors",
    config: {
      origin: ["http://localhost:3000", "http://localhost:1338","http://localhost:5173","http://192.168.1.5:5173"], 
      credentials: true,
    },
  },
  "strapi::poweredBy",
  "strapi::query",
  "strapi::body",
  "strapi::session",
  "strapi::favicon",
  { name: "global::upload-guard" },
  "strapi::public",
];
