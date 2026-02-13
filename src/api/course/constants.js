'use strict';

/**
 * Constants for Course API
 * Centralizes complex populate objects to maintain DRY principle.
 */

const COURSE_POPULATE = {
  picture: true,
  course_types: true,
  problem_types: true,
  users_permissions_user: true,
  weeks: {
    populate: {
      users_permissions_user: true,
      lessons: {
        populate: {
          video: true,
          users_permissions_user: true
        }
      }
    }
  },
};

module.exports = {
  COURSE_POPULATE,
};
