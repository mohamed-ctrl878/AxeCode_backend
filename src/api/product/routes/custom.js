module.exports = {
  routes: [
    {
      method: "GET",
      path: "/products/test-auth",
      handler: "product.testAuth",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/products/protected-data",
      handler: "product.getProtectedData",
      config: {
        auth: false,
      },
    },
  ],
};
