'use strict';

/**
 * Job Ad Feed Service
 * 
 * Matches open project roles to the user's job_title_tag selections.
 * Used by the recommendation controller to interleave job ads into the blog feed.
 * Pattern: after every 10 blogs → inject 2 job ads.
 */
module.exports = {
  /**
   * Get matching open roles for a user based on their job_title_tag selections.
   * 
   * @param {Object} user - Authenticated user object
   * @param {number} limit - Max number of job ads to return
   * @returns {Promise<Object[]>} Array of matched open roles with project info
   */
  async getMatchingJobAds(user, limit = 4) {
    // 1. Get user's selected job title tags
    const userJobTitles = await strapi.documents('api::user-job-title.user-job-title').findMany({
      filters: { users_permissions_user: { documentId: user.documentId } },
      populate: ['job_title_tag'],
    });

    const userTagIds = userJobTitles
      .map(ujt => ujt.job_title_tag?.id)
      .filter(Boolean);

    // 2. Find open project roles
    let openRoles;

    if (userTagIds.length > 0) {
      // Prioritize roles matching user's tags
      const matchedRoles = await strapi.db.query('api::project-role.project-role').findMany({
        where: {
          is_open: true,
          job_title_tag: { id: { $in: userTagIds } },
        },
        populate: {
          project: { populate: ['publisher'] },
          job_title_tag: true,
        },
        limit: limit,
        orderBy: { createdAt: 'desc' },
      });

      // If not enough matched, backfill with any open roles
      if (matchedRoles.length < limit) {
        const matchedIds = matchedRoles.map(r => r.id);
        const backfill = await strapi.db.query('api::project-role.project-role').findMany({
          where: {
            is_open: true,
            id: { $notIn: matchedIds.length > 0 ? matchedIds : [0] },
          },
          populate: {
            project: { populate: ['publisher'] },
            job_title_tag: true,
          },
          limit: limit - matchedRoles.length,
          orderBy: { createdAt: 'desc' },
        });
        openRoles = [...matchedRoles, ...backfill];
      } else {
        openRoles = matchedRoles;
      }
    } else {
      // No user tags — return any open roles
      openRoles = await strapi.db.query('api::project-role.project-role').findMany({
        where: { is_open: true },
        populate: {
          project: { populate: ['publisher'] },
          job_title_tag: true,
        },
        limit: limit,
        orderBy: { createdAt: 'desc' },
      });
    }

    // 3. Filter out roles from archived/draft projects and roles where user is already a member
    const activeRoles = [];
    for (const role of openRoles) {
      if (!role.project || !['active', 'paused'].includes(role.project.status)) continue;

      // Check if user is already a member of this project
      const isMember = await strapi.db.query('api::project-member.project-member').findOne({
        where: {
          project: role.project.id,
          users_permissions_user: user.id,
          is_active: true,
        },
      });
      if (isMember) continue;

      // Check if user already has a pending application for this role
      const hasApplied = await strapi.db.query('api::project-application.project-application').findOne({
        where: {
          user: user.id,
          project_role: role.id,
          status: 'pending',
        },
      });

      activeRoles.push({
        _type: 'job_ad',
        role_id: role.id,
        role_documentId: role.documentId,
        job_title: {
          slug: role.job_title_tag?.slug,
          label_ar: role.job_title_tag?.label_ar,
          label_en: role.job_title_tag?.label_en,
        },
        custom_label: role.custom_label,
        required_level: role.required_level,
        slots: role.slots,
        is_matched: userTagIds.includes(role.job_title_tag?.id),
        has_applied: !!hasApplied,
        project: {
          documentId: role.project.documentId,
          title: role.project.title,
          methodology: role.project.methodology,
          status: role.project.status,
          publisher: role.project.publisher
            ? { username: role.project.publisher.username, documentId: role.project.publisher.documentId }
            : null,
        },
      });
    }

    return activeRoles;
  },
};
