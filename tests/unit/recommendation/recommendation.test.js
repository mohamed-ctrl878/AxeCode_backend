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

  // ==================== Scoring Matrix Tests ====================
  describe("Scoring Matrix", () => {
    it("should return correct scores for each action", () => {
      expect(recommendationLogic.getActionScore("click")).toBe(1);
      expect(recommendationLogic.getActionScore("like")).toBe(2);
      expect(recommendationLogic.getActionScore("report")).toBe(-5);
    });

    it("should return 0 for unknown actions", () => {
      expect(recommendationLogic.getActionScore("unknown")).toBe(0);
      expect(recommendationLogic.getActionScore("")).toBe(0);
      expect(recommendationLogic.getActionScore(null)).toBe(0);
    });
  });

  // ==================== Interest Map Update Tests ====================
  describe("Interest Map Updates", () => {
    it("should INCREMENT tag weights on LIKE action", () => {
      const user = mockUsers.user1;
      const content = mockContent.article1;

      const result = recommendationLogic.calculateInterestUpdate(
        user.interest_map,
        content.tags,
        "like"
      );

      expect(result.updated).toBe(true);
      expect(result.pointsPerTag).toBe(1); // 2 points / 2 tags = 1 per tag
      expect(result.interestMap.javascript).toBe(1);
      expect(result.interestMap.typescript).toBe(1);
    });

    it("should INCREMENT tag weights on CLICK action", () => {
      const user = mockUsers.user1;
      const content = mockContent.blog1;

      const result = recommendationLogic.calculateInterestUpdate(
        user.interest_map,
        content.tags,
        "click"
      );

      expect(result.updated).toBe(true);
      expect(result.pointsPerTag).toBeCloseTo(0.333, 2); // 1 point / 3 tags
      expect(result.interestMap.python).toBeCloseTo(0.333, 2);
      expect(result.interestMap.machine_learning).toBeCloseTo(0.333, 2);
      expect(result.interestMap.ai).toBeCloseTo(0.333, 2);
    });

    it("should DECREMENT tag weights on REPORT action", () => {
      const user = mockUsers.user2;
      const content = mockContent.article1;

      const result = recommendationLogic.calculateInterestUpdate(
        user.interest_map,
        content.tags,
        "report"
      );

      expect(result.updated).toBe(true);
      expect(result.pointsPerTag).toBe(-2.5); // -5 points / 2 tags
      expect(result.interestMap.javascript).toBe(2.5); // 5 - 2.5
      expect(result.interestMap.typescript).toBe(-2.5); // 0 - 2.5
      expect(result.interestMap.react).toBe(3); // unchanged
    });

    it("should ACCUMULATE scores for repeated interactions", () => {
      let interestMap = {};

      // First like
      const result1 = recommendationLogic.calculateInterestUpdate(
        interestMap,
        ["javascript"],
        "like"
      );
      interestMap = result1.interestMap;
      expect(interestMap.javascript).toBe(2);

      // Second like
      const result2 = recommendationLogic.calculateInterestUpdate(
        interestMap,
        ["javascript"],
        "like"
      );
      interestMap = result2.interestMap;
      expect(interestMap.javascript).toBe(4);

      // Click adds 1
      const result3 = recommendationLogic.calculateInterestUpdate(
        interestMap,
        ["javascript"],
        "click"
      );
      interestMap = result3.interestMap;
      expect(interestMap.javascript).toBe(5);
    });

    it("should NOT update for empty tags", () => {
      const result = recommendationLogic.calculateInterestUpdate({}, [], "like");
      expect(result.updated).toBe(false);
    });

    it("should NOT update for unknown actions", () => {
      const result = recommendationLogic.calculateInterestUpdate(
        {},
        ["javascript"],
        "unknown"
      );
      expect(result.updated).toBe(false);
    });
  });

  // ==================== Seen History Tests ====================
  describe("Seen History Tracking", () => {
    it("should add content to seen history", () => {
      const history = recommendationLogic.updateSeenHistory([], "article", "doc-001");
      expect(history).toContain("article:doc-001");
      expect(history.length).toBe(1);
    });

    it("should not duplicate content in seen history", () => {
      let history = ["article:doc-001"];
      history = recommendationLogic.updateSeenHistory(history, "article", "doc-001");
      expect(history.filter((h) => h === "article:doc-001").length).toBe(1);
    });

    it("should maintain circular buffer of 500 items", () => {
      let history = [];
      for (let i = 0; i < 510; i++) {
        history = recommendationLogic.updateSeenHistory(history, "article", `doc-${i}`);
      }
      expect(history.length).toBe(500);
      expect(history[0]).toBe("article:doc-10"); // First 10 should be removed
      expect(history[499]).toBe("article:doc-509"); // Last added
    });
  });

  // ==================== End-to-End Workflow Tests ====================
  describe("Complete Workflow Simulation", () => {
    it("should correctly update user profile after LIKE interaction", () => {
      // Simulate: User1 likes Article1 (tags: javascript, typescript)
      const user = { ...mockUsers.user1 };
      const content = mockContent.article1;

      // Step 1: Update interest map
      const interestResult = recommendationLogic.calculateInterestUpdate(
        user.interest_map,
        content.tags,
        "like"
      );
      user.interest_map = interestResult.interestMap;

      // Step 2: Update seen history
      user.seen_history = recommendationLogic.updateSeenHistory(
        user.seen_history,
        "article",
        content.documentId
      );

      // Assertions
      expect(user.interest_map.javascript).toBe(1);
      expect(user.interest_map.typescript).toBe(1);
      expect(user.seen_history).toContain("article:article-001");
    });

    it("should correctly update user profile after REPORT interaction", () => {
      // Simulate: User2 reports Article1 (already has javascript: 5)
      const user = { ...mockUsers.user2 };
      const content = mockContent.article1;

      // Step 1: Update interest map with penalty
      const interestResult = recommendationLogic.calculateInterestUpdate(
        user.interest_map,
        content.tags,
        "report"
      );
      user.interest_map = interestResult.interestMap;

      // Assertions
      expect(user.interest_map.javascript).toBe(2.5); // 5 - 2.5
      expect(user.interest_map.react).toBe(3); // unchanged
    });

    it("should correctly update user profile after COMMENT interaction", () => {
      // Comment uses click score (+1)
      const user = { ...mockUsers.user1 };
      const content = mockContent.blog1; // 3 tags

      const interestResult = recommendationLogic.calculateInterestUpdate(
        user.interest_map,
        content.tags,
        "click" // Comment uses click score
      );
      user.interest_map = interestResult.interestMap;

      expect(user.interest_map.python).toBeCloseTo(0.333, 2);
      expect(user.interest_map.machine_learning).toBeCloseTo(0.333, 2);
      expect(user.interest_map.ai).toBeCloseTo(0.333, 2);
    });
  });
});
