'use strict';

/**
 * Maps content_types enum values to their Strapi UID and owner field.
 * This is the SINGLE SOURCE OF TRUTH for ownership resolution.
 * 
 * @type {Record<string, { uid: string, ownerField: string }>}
 */
const OWNERSHIP_MAP = {
  course: { uid: 'api::course.course',   ownerField: 'users_permissions_user' },
  event:  { uid: 'api::event.event',     ownerField: 'users_permissions_user' },
  article: { uid: 'api::article.article', ownerField: 'author' },
  blog:    { uid: 'api::blog.blog',       ownerField: 'publisher' },
  payout:  { uid: 'api::payout.payout',   ownerField: 'user' },
  project: { uid: 'api::project.project', ownerField: 'publisher' },
};

/**
 * Supported interaction types that trigger notifications.
 * @type {string[]}
 */
const INTERACTION_TYPES = ['like', 'rate', 'comment', 'report', 'payout_request', 'payout_paid', 'payout_rejected', 'project_invite', 'project_apply', 'project_accepted', 'task_assigned', 'sprint_started'];

/**
 * Matrix defining which interactions are valid for which content types.
 * Derived from the actual enum values in each interaction schema.
 */
const INTERACTION_CONTENT_MATRIX = {
  like:    ['course', 'event', 'blog'],             // article uses rate instead of like
  rate:    ['course', 'article', 'event', 'blog'],  // article relies on rating not likes
  comment: ['course', 'article', 'blog', 'event'],
  report:  ['course', 'article', 'blog', 'event'],
  payout_request:  ['payout'],
  payout_paid:     ['payout'],
  payout_rejected: ['payout'],
  project_invite:   ['project'],
  project_apply:    ['project'],
  project_accepted: ['project'],
  task_assigned:    ['project'],
  sprint_started:   ['project'],
};

module.exports = {
  OWNERSHIP_MAP,
  INTERACTION_TYPES,
  INTERACTION_CONTENT_MATRIX,
};
