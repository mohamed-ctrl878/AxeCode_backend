module.exports = ({ env }) => ({
  'users-permissions': {
    config: {
      jwtSecret: env('JWT_SECRET') || env('ADMIN_JWT_SECRET'),
    },
  },
  // ...
  mcp: {
    enabled: true,
    config: {
      session: {
        type: 'memory',
      },
    },
  },
  upload: {
    config: {
      providerOptions: {
        localServer: {},
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
      optimize: true,
    },
  },
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: 'smtp.gmail.com',
        port: 587,
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      },
      settings: {
        defaultFrom: process.env.GMAIL_USER,
        defaultReplyTo: process.env.GMAIL_USER,
      },
    },
  },
});
