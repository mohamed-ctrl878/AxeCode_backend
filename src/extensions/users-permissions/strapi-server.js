'use strict';

// This extension intentionally does not override any controller or service
// so Strapi's built-in users-permissions plugin handles registration.

module.exports = (plugin) => {
  return plugin;
};