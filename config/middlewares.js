module.exports = [
  { name: "global::security-pipeline" },
  { name: "global::jwt-cookie" },
  "strapi::logger",
  "strapi::errors",
  "strapi::security",
  {
    name: "strapi::cors",
    config: {
      origin: [
        "http://localhost:3000",
        "http://localhost:1338",
        "http://localhost:5173",
        "https://axe-code.vercel.app",
        env("CORS_ORIGIN", "*"),
      ],
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
