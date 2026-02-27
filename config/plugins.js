module.exports = {
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
        localServer: {
          maxage: 300000
        },
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
      // Disable image optimization (helps avoid EPERM on Windows upload unlink)
      breakpoints: {
        xlarge: 1920,
        large: 1000,
        medium: 750,
        small: 500,
        xsmall: 64
      },
      optimize: false, // Temporarily disable
    },
  },
};
