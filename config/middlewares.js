module.exports = ({ env }) => {
  // Build the allowed origins list dynamically
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:1338",
    "http://localhost:5173",
    "https://axe-code.vercel.app",
  ];

  // Add any custom origin from environment (e.g., Vercel preview URLs)
  const envOrigin = env("CORS_ORIGIN", "");
  if (envOrigin) {
    // Support comma-separated origins like "https://a.com,https://b.com"
    envOrigin.split(",").forEach((o) => {
      const trimmed = o.trim();
      if (trimmed) allowedOrigins.push(trimmed);
    });
  }

  return [
    "strapi::logger",
    "strapi::errors",
    {
      name: "strapi::security",
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            "connect-src": ["'self'", "https:"],
            "img-src": ["'self'", "data:", "blob:", "https:"],
            "media-src": ["'self'", "data:", "blob:", "https:"],
            upgradeInsecureRequests: null,
          },
        },
        // Allow cross-origin resource loading (images, uploads, etc.)
        crossOriginResourcePolicy: { policy: "cross-origin" },
        crossOriginEmbedderPolicy: false,
      },
    },
    {
      name: "strapi::cors",
      config: {
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
        headers: [
          "Content-Type",
          "Authorization",
          "Origin",
          "Accept",
          "cf-no-browser-warning",
        ],
        credentials: true,
        keepHeadersOnError: true,
      },
    },
    { name: "global::security-pipeline" },
    { name: "global::jwt-cookie" },
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
};
