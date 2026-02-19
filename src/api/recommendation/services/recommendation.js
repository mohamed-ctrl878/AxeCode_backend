"use strict";

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService("api::recommendation.recommendation", ({ strapi }) => {
  const service = {
    /**
     * Normalize a tag string: lowercase, trim, and replace spaces with underscores.
     */
    normalizeTag(tag) {
      if (typeof tag !== "string") return "";
      return tag
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "_");
    },

    /**
     * Processes a list of tags: normalizes them and removes duplicates/empty strings.
     */
    processTags(tags) {
      if (!Array.isArray(tags)) return [];
      const normalized = tags.map((t) => service.normalizeTag(t)).filter(Boolean);
      return [...new Set(normalized)];
    },

    /**
     * Auto-tagging fallback logic.
     * Extracts tags from text using stop-words removal and frequency analysis.
     */
    extractTagsFromText(text, limit = 5) {
      if (!text) return [];

      // Basic common stop words (Arabic and English)
      const stopWords = new Set([
        "في", "من", "على", "إلى", "عن", "مع", "هذا", "هذه", "التي", "الذي", "أن", "أو", "لا", "ما",
        "the", "is", "at", "which", "on", "and", "a", "an", "for", "with", "to", "of", "in"
      ]);

      // Sanitize and split into words
      const words = text
        .toLowerCase()
        .replace(/[^\w\s\u0621-\u064A]/g, "") // Keep alphanumeric and Arabic chars
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stopWords.has(w));

      // Calculate frequency
      const freq = {};
      words.forEach((w) => {
        freq[w] = (freq[w] || 0) + 1;
      });

      // Sort by frequency and return top-N
      return Object.keys(freq)
        .sort((a, b) => freq[b] - freq[a])
        .slice(0, limit);
    },

    /**
     * Upsert tags into Global Tag collection and increment their counts.
     */
    async syncGlobalTags(tags) {
      for (const tagName of tags) {
        const existing = await strapi.db.query("api::global-tag.global-tag").findOne({
          where: { name: tagName },
        });

        if (existing) {
          await strapi.db.query("api::global-tag.global-tag").update({
            where: { id: existing.id },
            data: {
              count: existing.count + 1,
              last_used: new Date(),
            },
          });
        } else {
          await strapi.db.query("api::global-tag.global-tag").create({
            data: {
              name: tagName,
              count: 1,
              last_used: new Date(),
            },
          });
        }
      }
    },

    /**
     * Content Processing Pipeline: Normalizes tags, applies auto-tagging if needed.
     */
    async processContentTags(data, contentType) {
      let tags = service.processTags(data.tags);

      // If still empty, try auto-tagging
      if (!tags || tags.length === 0) {
        const sourceText = data.body_text || data.description || data.caption || data.title || "";
        tags = service.extractTagsFromText(sourceText);
      }

      // Still empty? Fallback to content type name
      if (!tags || tags.length === 0) {
        tags = [contentType];
      }

      data.tags = tags;
      await service.syncGlobalTags(tags);
      return data;
    },

    /**
     * Helper to be called from content type lifecycles (beforeCreate, beforeUpdate).
     */
    /**
     * Helper to be called from content type lifecycles (beforeCreate, beforeUpdate).
     */
    async handleLifecycleEvent(event) {
      try {
        if (!event.params || !event.params.data) return;
        const { data } = event.params;
        const contentType = event.model.singularName;
        await service.processContentTags(data, contentType);
      } catch (error) {
        strapi.log.error(`[Recommendation] Lifecycle hook failed for ${event.model.singularName}:`, error.message);
      }
    },

    /**
     * Get score for a user action.
     */
    getActionScore(action) {
      const scores = {
        click: 1,
        like: 2,
        report: -5,
      };
      return scores[action] || 0;
    },

    /**
     * Update user interest map based on interaction with content.
     */
    async updateUserInterests(userId, contentId, contentType, action) {
      try {
        const score = service.getActionScore(action);
        if (score === 0) return;

        // Fetch content to get tags
        const content = await strapi.documents(`api::${contentType}.${contentType}`).findOne({
          documentId: contentId,
        });

        if (!content || !content.tags || content.tags.length === 0) return;

        const pointsPerTag = score / content.tags.length;

        // Fetch user
        const user = await strapi.db.query("plugin::users-permissions.user").findOne({
          where: { id: userId },
        });

        if (!user) return;

        let interestMap = user.interest_map || {};

        // Update interest scores
        content.tags.forEach((tag) => {
          interestMap[tag] = (interestMap[tag] || 0) + pointsPerTag;
        });

        // Pruning: Keep only top 100 tags to prevent map bloat
        let sortedTags = Object.entries(interestMap).sort((a, b) => b[1] - a[1]);
        if (sortedTags.length > 100) {
          interestMap = Object.fromEntries(sortedTags.slice(0, 100));
        }

        // Update seen history (circular buffer of 500)
        let seenHistory = user.seen_history || [];
        const contentRef = `${contentType}:${contentId}`;

        seenHistory = seenHistory.filter(id => id !== contentRef);
        seenHistory.push(contentRef);

        if (seenHistory.length > 500) {
          seenHistory.shift();
        }

        // Update User
        await strapi.db.query("plugin::users-permissions.user").update({
          where: { id: userId },
          data: {
            interest_map: interestMap,
            seen_history: seenHistory,
          },
        });

        // Increment content engagement score
        if (action === "click" || action === "like") {
          await strapi.documents(`api::${contentType}.${contentType}`).update({
            documentId: contentId,
            data: {
              engagement_score: (content.engagement_score || 0) + Math.abs(score),
            },
          });
        }
      } catch (error) {
        strapi.log.error("Failed to update user interests:", error.message);
      }
    },

    /**
     * Get personalized feed for a user.
     * Supports filtering by type or returning a grouped object.
     */
    /**
     * Get personalized feed for a user.
     * Supports filtering by type or returning a grouped object.
     */
    async getFeed(user, limit = 20, type = null) {
      if (!user) return type ? [] : {};

      const interestMap = user.interest_map || {};
      const seenHistory = new Set(user.seen_history || []);
      const contentTypes = type ? [type] : ["article", "blog", "post", "course", "problem", "live-stream", "event"];

      // Phase 1: Context Analysis - Get Top-10 tags
      const queryTags = Object.entries(interestMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag);

      // Phase 2 & 3: Candidate Generation & Ranking
      let personalizedCandidates = [];
      if (queryTags.length > 0) {
        personalizedCandidates = await service.getCandidateContents(queryTags, seenHistory, contentTypes);
        personalizedCandidates = service.rankContents(personalizedCandidates, interestMap);
      }

      // Phase 4: Diversity & Mixing (80/20 Rule)
      const personalizedCount = Math.floor(limit * 0.8);
      const discoveryCount = limit - personalizedCount;

      const personalizedFeed = personalizedCandidates.slice(0, personalizedCount);
      const personalizedRefs = personalizedFeed.map(i => `${i.contentType}:${i.documentId}`);

      const discoveryCandidates = await service.getTrendingContent(discoveryCount, seenHistory, personalizedRefs, contentTypes);

      let finalFeed = [...personalizedFeed, ...discoveryCandidates];

      // Phase 5: Scarcity handling (Backfill if needed)
      if (finalFeed.length < limit) {
        const currentRefs = finalFeed.map(i => `${i.contentType}:${i.documentId}`);
        const backfill = await service.getLatestContent(limit - finalFeed.length, seenHistory, currentRefs, contentTypes);
        finalFeed = [...finalFeed, ...backfill];
      }

      // Final shuffle
      const sortedFeed = finalFeed.sort(() => Math.random() - 0.5);

      // Phase 6: Enrichment with Permissions (Entitlements)
      await service.enrichWithPermissions(sortedFeed, user.id);

      // If a specific type was requested, return flat list
      if (type) return sortedFeed;

      // Otherwise, return grouped by type for separate UI sections
      return {
        articles: sortedFeed.filter(i => i.contentType === "article"),
        blogs: sortedFeed.filter(i => i.contentType === "blog"),
        posts: sortedFeed.filter(i => i.contentType === "post"),
        courses: sortedFeed.filter(i => i.contentType === "course"),
        problems: sortedFeed.filter(i => i.contentType === "problem"),
        liveStreams: sortedFeed.filter(i => i.contentType === "live-stream"),
        events: sortedFeed.filter(i => i.contentType === "event"),
        all: sortedFeed
      };
    },

    /**
     * Enrich content items with price and access status using Entitlement system.
     */
    async enrichWithPermissions(items, userId = null) {
      if (!items || !Array.isArray(items)) return items;

      const mapping = {
        'course': 'course',
        'live-stream': 'uplive',
        'event': 'upevent',
      };

      const facade = strapi.service('api::entitlement.content-access-facade');
      if (!facade) return items;

      await Promise.all(items.map(async (item) => {
        const entitlementType = mapping[item.contentType];
        if (entitlementType) {
          try {
            const details = await facade.getFullDetails(item.documentId, entitlementType, userId);
            item.price = details.price;
            item.hasAccess = details.hasAccess;
            item.student_count = details.studentCount;
            item.entitlementsId = details.entitlementId;
          } catch (error) {
            strapi.log.error(`[Recommendation] Enrichment failed for ${item.contentType} ${item.documentId}:`, error.message);
            item.hasAccess = false;
          }
        } else {
          // Default for non-entitlement content (articles, blogs, etc.)
          item.hasAccess = true;
        }
      }));

      return items;
    },

    /**
     * Fetch candidates from all participating content types in parallel.
     */
    async getCandidateContents(tags, seenHistory, contentTypes) {
      const results = await Promise.all(
        contentTypes.map(async (type) => {
          try {
            const candidates = await strapi.documents(`api::${type}.${type}`).findMany({
              filters: {
                tags: { $contains: tags },
              },
              populate: "*",
              limit: 50,
            });
            return candidates.map(c => ({ ...c, contentType: type }));
          } catch (e) {
            strapi.log.warn(`Candidate fetch failed for ${type}: ${e.message}`);
            return [];
          }
        })
      );

      const allCandidates = results.flat();
      return allCandidates.filter(c => !seenHistory.has(`${c.contentType}:${c.documentId}`));
    },

    /**
     * Rank candidates based on user interest scores.
     */
    rankContents(candidates, interestMap) {
      return candidates.map(c => {
        let relevanceScore = 0;
        if (c.tags) {
          c.tags.forEach(tag => {
            relevanceScore += (interestMap[tag] || 0);
          });
        }
        relevanceScore *= (1 + (c.engagement_score || 0) / 1000);
        return { ...c, relevanceScore };
      }).sort((a, b) => b.relevanceScore - a.relevanceScore);
    },

    /**
     * Get trending content for discovery in parallel.
     */
    async getTrendingContent(limit, seenHistory, excludeRefs, contentTypes) {
      const results = await Promise.all(
        contentTypes.map(async (type) => {
          try {
            const items = await strapi.documents(`api::${type}.${type}`).findMany({
              sort: [{ engagement_score: "desc" }],
              populate: "*",
              limit: 10,
            });
            return items.map(i => ({ ...i, contentType: type }));
          } catch (e) {
            return [];
          }
        })
      );

      return results.flat()
        .filter(i => !seenHistory.has(`${i.contentType}:${i.documentId}`) && !excludeRefs.includes(`${i.contentType}:${i.documentId}`))
        .sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0))
        .slice(0, limit);
    },

    /**
     * Get latest content for backfill in parallel.
     */
    async getLatestContent(limit, seenHistory, excludeRefs, contentTypes) {
      const results = await Promise.all(
        contentTypes.map(async (type) => {
          try {
            const items = await strapi.documents(`api::${type}.${type}`).findMany({
              sort: [{ createdAt: "desc" }],
              populate: "*",
              limit: 10,
            });
            return items.map(i => ({ ...i, contentType: type }));
          } catch (e) {
            return [];
          }
        })
      );

      return results.flat()
        .filter(i => !seenHistory.has(`${i.contentType}:${i.documentId}`) && !excludeRefs.includes(`${i.contentType}:${i.documentId}`))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
    },

    /**
     * Apply time decay to user interest maps using batch processing.
     * Prevents memory overflow and database locking on large user bases.
     */
    async applyTimeDecay(decayFactor = 0.9, batchSize = 100) {
      let offset = 0;
      let totalProcessed = 0;

      while (true) {
        const users = await strapi.db.query("plugin::users-permissions.user").findMany({
          limit: batchSize,
          offset: offset,
        });

        if (!users || users.length === 0) break;

        for (const user of users) {
          if (!user.interest_map) continue;

          let interestMap = { ...user.interest_map };
          let changed = false;

          for (const [tag, score] of Object.entries(interestMap)) {
            const newScore = score * decayFactor;
            if (newScore < 0.1) {
              delete interestMap[tag];
              changed = true;
            } else {
              interestMap[tag] = newScore;
              changed = true;
            }
          }

          if (changed) {
            await strapi.db.query("plugin::users-permissions.user").update({
              where: { id: user.id },
              data: {
                interest_map: interestMap,
                last_decay_date: new Date(),
              },
            });
          }
        }

        totalProcessed += users.length;
        offset += batchSize;
      }

      strapi.log.info(`[Recommendation] Time decay applied to ${totalProcessed} users.`);
    },

    /**
     * Get tag suggestions for autocomplete.
     */
    async getSuggestions(query, limit = 10) {
      if (!query) return [];

      const normalizedQuery = service.normalizeTag(query);

      return await strapi.db.query("api::global-tag.global-tag").findMany({
        where: {
          name: { $contains: normalizedQuery },
        },
        orderBy: { count: "desc" },
        limit,
      });
    }
  };

  return service;
});
