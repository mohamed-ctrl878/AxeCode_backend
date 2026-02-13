module.exports = {
  routes: [
    // Unified feed (all types grouped)
    {
      method: "GET",
      path: "/recommendations/feed",
      handler: "recommendation.getFeed",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    // Separate endpoints per content type
    {
      method: "GET",
      path: "/recommendations/articles",
      handler: "recommendation.getArticles",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/recommendations/blogs",
      handler: "recommendation.getBlogs",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/recommendations/posts",
      handler: "recommendation.getPosts",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/recommendations/courses",
      handler: "recommendation.getCourses",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/recommendations/problems",
      handler: "recommendation.getProblems",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/recommendations/live-streams",
      handler: "recommendation.getLiveStreams",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/recommendations/events",
      handler: "recommendation.getEvents",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    // Tag suggestions for autocomplete
    {
      method: "GET",
      path: "/recommendations/suggest",
      handler: "recommendation.suggest",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
