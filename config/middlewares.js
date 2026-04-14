module.exports = ({ env }) => [
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
      headers: ["Content-Type", "Authorization", "Origin", "Accept", "cf-no-browser-warning"],
      credentials: true,
    },
  },
  "strapi::poweredBy",
  "strapi::query",
  "strapi::body",
  {
    name: "strapi::session",
    config: {
      secure: false,
    },
  },
  "strapi::favicon",
  { name: "global::upload-guard" },
  "strapi::public",
];
