"use strict";

import { describe, it, expect, vi, beforeEach } from "vitest";
const StrapiMock = require("../../helpers/strapi-mock");
const recommendationController = require("../../../src/api/recommendation/controllers/recommendation");

describe("Recommendation API - End-to-End (E2E) Flow Simulation", () => {
    let strapi;
    let controller;

    beforeEach(() => {
        strapi = new StrapiMock();

        // Create a mock service
        const mockService = {
            getFeed: vi.fn().mockResolvedValue({ articles: [], all: [] }),
            getSuggestions: vi.fn().mockResolvedValue([{ name: "js" }])
        };

        strapi.registerService("api::recommendation.recommendation", mockService);

        // Register controller
        const factory = recommendationController({ strapi });
        controller = factory;
    });

    describe("GET /recommendations/feed", () => {
        it("should return 401 if user is not authenticated", async () => {
            const ctx = strapi.mockContext({ state: {} });
            ctx.unauthorized = vi.fn().mockReturnValue({ status: 401 });

            const result = await controller.getFeed(ctx);

            expect(ctx.unauthorized).toHaveBeenCalled();
            expect(result.status).toBe(401);
        });

        it("should return personalized feed for authenticated user", async () => {
            const user = { id: 1, username: "tester", interest_map: { tech: 5 } };
            const ctx = strapi.mockContext({
                state: { user },
                query: { limit: "5" }
            });

            const result = await controller.getFeed(ctx);

            expect(strapi.service("api::recommendation.recommendation").getFeed)
                .toHaveBeenCalledWith(user, 5, undefined);
            expect(result).toHaveProperty("data");
        });
    });

    describe("GET /recommendations/articles", () => {
        it("should call service with 'article' type filter", async () => {
            const user = { id: 1 };
            const ctx = strapi.mockContext({ state: { user } });

            await controller.getArticles(ctx);

            expect(strapi.service("api::recommendation.recommendation").getFeed)
                .toHaveBeenCalledWith(user, 20, "article");
        });
    });

    describe("GET /recommendations/suggest", () => {
        it("should return suggestions based on query", async () => {
            const ctx = strapi.mockContext({ query: { q: "jav" } });

            const result = await controller.suggest(ctx);

            expect(strapi.service("api::recommendation.recommendation").getSuggestions)
                .toHaveBeenCalledWith("jav");
            expect(result.data).toContainEqual({ name: "js" });
        });
    });
});
