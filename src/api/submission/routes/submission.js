"use strict";

module.exports = {
  routes: [
    {
      method: "POST",
      path: "/submissions",
      handler: "submission.create",
    },
    {
      method: "POST",
      path: "/submissions/test",
      handler: "submission.testSubmit",
    },
    {
      method: "GET",
      path: "/submissions",
      handler: "submission.find",
    },
    {
      method: "GET",
      path: "/submissions/:id",
      handler: "submission.findOne",
    },
  ],
};
