"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/submissions",
      handler: "submission.create",
      config: {
        auth: false, // TEMPORARY DISABLE AUTH FOR TESTING
      },
    },
    {
      method: "POST",
      path: "/submissions/test",
      handler: "submission.testSubmit",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/submissions",
      handler: "submission.find",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/submissions/:id",
      handler: "submission.findOne",
      config: {
        auth: false,
      },
    },
  ],
};
