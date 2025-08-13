// // ./config/plugins.js

// module.exports = ({ env }) => ({
//   email: {
//     config: {
//       provider: 'nodemailer',
//       providerOptions: {
//         host: 'smtp.gmail.com',
//         port: 587,
//         secure: false,
//         auth: {
//           user: env('SMTP_USERNAME'),
//           pass: env('SMTP_PASSWORD'), // هنا تضع App Password
//         },
//       },
//       settings: {
//         defaultFrom: env('SMTP_USERNAME'),
//         defaultReplyTo: env('SMTP_USERNAME'),
//       },
//     },
//   },
// });

module.exports = ({ env }) => ({
  email: {
    config: {
      provider: "nodemailer",
      providerOptions: {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: env("GMAIL_USER"),
          pass: env("GMAIL_APP_PASSWORD"),
        },
      },
      settings: {
        defaultFrom: env("GMAIL_USER"),
        defaultReplyTo: env("GMAIL_USER"),
      },
    },
  },
  "users-permissions": {
    config: {
      register: {
        emailConfirmation: true,
      },
      jwt: {
        expiresIn: "30d", // مدة صلاحية الـ token
      },
      // إعدادات HttpOnly cookies
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 يوم
        path: "/",
        domain: process.env.COOKIE_DOMAIN || undefined,
      },
    },
  },
});
