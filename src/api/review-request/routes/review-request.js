module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/projects/:id/review-requests',
      handler: 'review-request.findReviewRequests',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/projects/:id/review-requests',
      handler: 'review-request.createReviewRequest',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'PATCH',
      path: '/projects/:id/review-requests/:requestId/resolve',
      handler: 'review-request.resolveReviewRequest',
      config: { policies: [], middlewares: [] },
    },
  ],
};
