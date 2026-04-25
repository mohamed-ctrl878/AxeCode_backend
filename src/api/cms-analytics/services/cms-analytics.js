'use strict';

/**
 * Service: cms-analytics
 * Provides granular, time-series metrics for the Insight Hub.
 */
module.exports = {
  /**
   * Helper to generate a zero-filled timeline for a collection
   */
  async getTimeline(uid, days = 60, dateField = 'createdAt') {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const items = await strapi.db.query(uid).findMany({
      where: { [dateField]: { $gte: startDate } },
      select: [dateField, 'id'],
    });

    const countsByDate = items.reduce((acc, item) => {
      const dateString = new Date(item[dateField]).toISOString().split('T')[0];
      acc[dateString] = (acc[dateString] || 0) + 1;
      return acc;
    }, {});

    const timeline = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      timeline.push({ time: dayStr, count: countsByDate[dayStr] || 0 });
    }
    return timeline;
  },

  /**
   * Fetches total counts and daily timeline for a resource
   */
  async getResourceMetrics(uid, days = 60, extraFilter = {}) {
    const [total, timeline] = await Promise.all([
      strapi.db.query(uid).count({ where: extraFilter }),
      this.getTimeline(uid, days),
    ]);
    return { total, timeline };
  },

  /**
   * Generates a timeline of NEW unique contributors per day
   */
  async getContributorMetrics(uid, relationField, days = 60) {
    const items = await strapi.db.query(uid).findMany({
      populate: [relationField],
      select: ['id', 'createdAt'],
    });

    const firstContribMap = {};
    items.forEach(item => {
      const userId = item[relationField]?.id;
      if (!userId) return;
      const date = new Date(item.createdAt).toISOString().split('T')[0];
      // Store the EARLIEST date this user contributed
      if (!firstContribMap[userId] || date < firstContribMap[userId]) {
        firstContribMap[userId] = date;
      }
    });

    const countsByDate = Object.values(firstContribMap).reduce((acc, date) => {
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    const timeline = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      timeline.push({ time: dayStr, count: countsByDate[dayStr] || 0 });
    }

    const totalUnique = Object.keys(firstContribMap).length;

    return { total: totalUnique, timeline };
  }
};
