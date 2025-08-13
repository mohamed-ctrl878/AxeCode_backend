module.exports = {
  routes: [
    {
      method: "POST",
      path: "/code-execution",
      handler: "code.executeCode",
    },
    {
      method: "POST",
      path: "/code-execution-admin",
      handler: "code.executeCode",
    },
    {
      method: "GET",
      path: "/protected-data",
      handler: "product.getProtectedData",
    },
  ],
};
// path: ./api/codeExecution/routes/codeExecution.js
