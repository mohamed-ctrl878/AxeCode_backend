"use strict";

module.exports = {
    /**
     * Get trending content sorted by Gravity Score.
     * Gravity = engagement_score / (hours_passed + 2)^1.8
     * Strict limit of 20 items.
     */
    async getTrendingFeed(user, limit = 20, type = null) {
        const strapiInstance = strapi;
        const contentTypes = type ? [type] : ["article", "blog", "post", "course", "problem", "live-stream", "event"];

        // 1. Fetch recent candidates (e.g., published in the last 60 days to limit processing)
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - 60);

        const results = await Promise.all(
            contentTypes.map(async (contentType) => {
                try {
                    const items = await strapiInstance.documents(`api::${contentType}.${contentType}`).findMany({
                        filters: {
                            createdAt: { $gte: recentDate.toISOString() }
                        },
                        populate: "*",
                        limit: 200, // Fetch up to 200 per type
                    });
                    return items.map(i => ({ ...i, contentType }));
                } catch (e) {
                    strapiInstance.log.warn(`[Trend] Failed to fetch candidates for ${contentType}: ${e.message}`);
                    return [];
                }
            })
        );

        let candidates = results.flat();

        // 2. Calculate Gravity Score
        const now = Date.now();
        candidates = candidates.map(item => {
            const createdAt = new Date(item.createdAt).getTime();
            const hoursPassed = Math.max((now - createdAt) / 3600000, 0); // Convert ms to hours

            const engagementScore = item.engagement_score || 0;
            // The HackerNews Gravity Formula
            const gravityScore = engagementScore / Math.pow(hoursPassed + 2, 1.8);

            return { ...item, gravityScore };
        });

        // 3. Sort by Gravity and Extract Top N
        candidates.sort((a, b) => b.gravityScore - a.gravityScore);
        const topTrending = candidates.slice(0, limit);

        // 4. Enrich with Permissions & Interactions using Existing Recommendation Service
        const recommendService = strapiInstance.service("api::recommendation.recommendation");
        if (recommendService) {
            if (typeof recommendService.enrichWithPermissions === 'function') {
                await recommendService.enrichWithPermissions(topTrending, user ? user.id : null);
            }
            if (typeof recommendService.enrichWithInteractions === 'function') {
                await recommendService.enrichWithInteractions(topTrending, user ? (user.documentId || user.id) : null);
            }
        }

        // 5. Group by Type if no specific type requested
        if (type) return topTrending;

        return {
            articles: topTrending.filter(i => i.contentType === "article"),
            blogs: topTrending.filter(i => i.contentType === "blog"),
            posts: topTrending.filter(i => i.contentType === "post"),
            courses: topTrending.filter(i => i.contentType === "course"),
            problems: topTrending.filter(i => i.contentType === "problem"),
            liveStreams: topTrending.filter(i => i.contentType === "live-stream"),
            events: topTrending.filter(i => i.contentType === "event"),
            all: topTrending
        };
    }
};
