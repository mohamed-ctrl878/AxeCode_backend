'use strict';

/**
 * Validates if a user has a specific granular permission on a project.
 * @param {object} strapi - The global strapi instance
 * @param {string} projectId - Document ID of the project
 * @param {number} userId - ID of the user
 * @param {string} requiredPermission - e.g. 'write_tasks', 'manage_members'
 * @returns {Promise<boolean>} True if authorized, false otherwise
 */
async function hasProjectPermission(strapi, projectId, userId, requiredPermission) {
  // Check if user is publisher
  const project = await strapi.documents('api::project.project').findOne({
    documentId: projectId,
    populate: ['publisher'],
  });

  if (!project) return false;
  if (project.publisher?.id === userId) return true; // Publisher has all permissions

  // Check if user is a member with the required permission
  const memberships = await strapi.documents('api::project-member.project-member').findMany({
    filters: { project: { documentId: projectId }, users_permissions_user: { id: userId }, is_active: true },
    populate: ['project_role'],
  });

  if (!memberships || memberships.length === 0) return false;

  const member = memberships[0];
  const permissions = member.project_role?.permissions || {};

  if (permissions.admin === true) return true; // Admins have all permissions
  
  if (requiredPermission && permissions[requiredPermission] === true) {
      return true;
  }

  return false;
}

module.exports = {
  hasProjectPermission,
};
