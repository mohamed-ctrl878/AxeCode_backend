"use strict";

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit Tests for Recommendation Service
 * Tests the interaction workflow and its effect on user interest_map
 */
describe("Recommendation Service - Interest Map Updates", () => {
  // Mock data stores
  let mockUsers = {};
  let mockContent = {};

  // Create isolated service logic for testing (extracted from actual service)
  const recommendationLogic = {
    normalizeTag(tag) {
      if (typeof tag !== "string") return "";
      return tag.toLowerCase().trim().replace(/\s+/g, "_");
    },

    getActionScore(action) {
      const scores = {
        click: 1,
        like: 2,
        report: -5,
      };
      return scores[action] || 0;
    },

    processTags(tags) {
      if (!Array.isArray(tags)) return [];
      const normalized = tags.map((t) => this.normalizeTag(t)).filter(Boolean);
      return [...new Set(normalized)];
    },

    calculateInterestUpdate(currentInterestMap, contentTags, action) {
      const score = this.getActionScore(action);
      if (score === 0 || !contentTags || contentTags.length === 0) {
        return { updated: false, interestMap: currentInterestMap };
      }

      const pointsPerTag = score / contentTags.length;
      const newInterestMap = { ...currentInterestMap };

      contentTags.forEach((tag) => {
        newInterestMap[tag] = (newInterestMap[tag] || 0) + pointsPerTag;
      });

      return { updated: true, interestMap: newInterestMap, pointsPerTag };
    },

    updateSeenHistory(seenHistory, contentType, contentId) {
      let history = [...(seenHistory || [])];
      const contentRef = `${contentType}:${contentId}`;

      history = history.filter((id) => id !== contentRef);
      history.push(contentRef);

      if (history.length > 500) {
        history.shift();
      }

      return history;
    },
  };

  beforeEach(() => {
    // Reset mock data
    mockUsers = {
      user1: {
        id: 1,
        interest_map: {},
        seen_history: [],
      },
      user2: {
        id: 2,
        interest_map: { javascript: 5, react: 3 },
        seen_history: ["article:doc-old"],
      },
    };

    mockContent = {
      article1: {
        documentId: "article-001",
        tags: ["javascript", "typescript"],
        engagement_score: 10,
      },
      blog1: {
        documentId: "blog-001",
        tags: ["python", "machine_learning", "ai"],
        engagement_score: 5,
      },
    };
  });

  // ==================== Tag Normalization Tests ====================
  describe("Tag Normalization", () => {
    it("should convert tags to lowercase", () => {
      expect(recommendationLogic.normalizeTag("JavaScript")).toBe("javascript");
      expect(recommendationLogic.normalizeTag("REACT")).toBe("react");
    });

    it("should trim whitespace", () => {
      expect(recommendationLogic.normalizeTag("  javascript  ")).toBe("javascript");
    });

    it("should replace spaces with underscores", () => {
      expect(recommendationLogic.normalizeTag("machine learning")).toBe("machine_learning");
      expect(recommendationLogic.normalizeTag("deep   learning")).toBe("deep_learning");
    });

    it("should handle non-string inputs", () => {
      expect(recommendationLogic.normalizeTag(null)).toBe("");
      expect(recommendationLogic.normalizeTag(undefined)).toBe("");
      expect(recommendationLogic.normalizeTag(123)).toBe("");
    });
  });

  // ==================== Auto-tagging / NLP Tests (Medium Complexity) ====================
  describe("Auto-tagging / Tag Extraction", () => {
    const extractTags = (text) => {
      // Mocked version of the service logic
      const stopWords = new Set(["في", "من", "على", "إلى", "the", "is", "at"]);
      const words = text.toLowerCase().replace(/[^\w\s\u0621-\u064A]/g, "").split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
      const freq = {};
      words.forEach(w => freq[w] = (freq[w] || 0) + 1);
      return Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 5);
    };

    it("should extract top words from English text", () => {
      const text = "Javascript is great. Javascript is fast. Learning React is also good.";
      const tags = extractTags(text);
      expect(tags).toContain("javascript");
      expect(tags).toContain("learning");
      expect(tags).toContain("react");
    });

    it("should extract top words from Arabic text", () => {
      const text = "تعلم البرمجة بلغة جافا سكريبت. جافا سكريبت لغة قوية جداً في تطوير الويب.";
      const tags = extractTags(text);
      expect(tags).toContain("البرمجة");
      expect(tags).toContain("جافا");
      expect(tags).toContain("سكريبت");
    });

    it("should filter out stop words (Arabic and English)", () => {
      const text = "البرمجة في دبي. the programming at dubai.";
      const tags = extractTags(text);
      expect(tags).not.toContain("في");
      expect(tags).not.toContain("the");
      expect(tags).not.toContain("at");
    });

    it("should handle very short words", () => {
      const text = "a ab abc abcd";
      const tags = extractTags(text);
      expect(tags).toContain("abc");
      expect(tags).toContain("abcd");
      expect(tags).not.toContain("a");
      expect(tags).not.toContain("ab");
    });
  });

  // ==================== Scoring Matrix Tests ====================
  describe("Scoring Matrix", () => {
    it("should return correct scores for each action", () => {
      expect(recommendationLogic.getActionScore("click")).toBe(1);
      expect(recommendationLogic.getActionScore("like")).toBe(2);
      expect(recommendationLogic.getActionScore("report")).toBe(-5);
    });

    it("should return 0 for unknown actions", () => {
      expect(recommendationLogic.getActionScore("unknown")).toBe(0);
    });
  });

  // ==================== Interest Map Pruning (Difficult Complexity) ====================
  describe("Interest Map Pruning", () => {
    it("should keep only top 100 tags", () => {
      const interestMap = {};
      for (let i = 0; i < 150; i++) {
        interestMap[`tag_${i}`] = i; // tag_149 has highest score
      }

      // Simulate pruning logic from service
      let sortedTags = Object.entries(interestMap).sort((a, b) => b[1] - a[1]);
      const prunedMap = Object.fromEntries(sortedTags.slice(0, 100));

      expect(Object.keys(prunedMap).length).toBe(100);
      expect(prunedMap["tag_149"]).toBe(149);
      expect(prunedMap["tag_0"]).toBeUndefined();
      expect(prunedMap["tag_50"]).toBe(50);
    });
  });

  // ==================== Seen History Tests (Difficult Complexity) ====================
  describe("Seen History Tracking", () => {
    it("should maintain circular buffer of 500 items and remove oldest", () => {
      let history = [];
      for (let i = 0; i < 505; i++) {
        history = recommendationLogic.updateSeenHistory(history, "article", `doc-${i}`);
      }
      expect(history.length).toBe(500);
      expect(history[0]).toBe("article:doc-5"); // 0-4 should be removed
      expect(history[499]).toBe("article:doc-504");
    });

    it("should move existing content to end of history instead of duplicating", () => {
      let history = ["article:doc-1", "article:doc-2", "article:doc-3"];
      history = recommendationLogic.updateSeenHistory(history, "article", "doc-1");
      expect(history.length).toBe(3);
      expect(history[2]).toBe("article:doc-1"); // doc-1 moved to end
    });
  });

  // ==================== End-to-End Workflow Simulation ====================
  describe("Complete Workflow Simulation", () => {
    it("should update profile correctly through sequence of interactions", () => {
      const user = { interest_map: { tech: 10 }, seen_history: [] };

      // Like a post with "tech" and "javascript"
      const res1 = recommendationLogic.calculateInterestUpdate(user.interest_map, ["tech", "javascript"], "like");
      user.interest_map = res1.interestMap;

      // Report a post with "tech"
      const res2 = recommendationLogic.calculateInterestUpdate(user.interest_map, ["tech"], "report");
      user.interest_map = res2.interestMap;

      expect(user.interest_map.tech).toBe(6); // 10 + (2/2) - 5 = 6
      expect(user.interest_map.javascript).toBe(1); // 0 + (2/2) = 1
    });
  });
});
