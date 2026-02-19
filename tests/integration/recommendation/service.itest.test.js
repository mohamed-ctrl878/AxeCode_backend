"use strict";

import { describe, it, expect, vi, beforeEach } from "vitest";
const StrapiMock = require("../../helpers/strapi-mock");
const recommendationService = require("../../../src/api/recommendation/services/recommendation");

describe("Recommendation Service - Integration Tests (iTest)", () => {
    let strapi;
    let service;

    beforeEach(() => {
        strapi = new StrapiMock();
        // Initialize the service with the mocked strapi
        const factory = recommendationService({ strapi });
        service = factory;
    });

    describe("syncGlobalTags", () => {
        it("should update existing tag count", async () => {
            const findOneSpy = vi.spyOn(strapi.db.query("api::global-tag.global-tag"), "findOne")
                .mockResolvedValue({ id: 10, name: "js", count: 5 });
            const updateSpy = vi.spyOn(strapi.db.query("api::global-tag.global-tag"), "update");

            await service.syncGlobalTags(["js"]);

            expect(findOneSpy).toHaveBeenCalledWith({ where: { name: "js" } });
            expect(updateSpy).toHaveBeenCalledWith({
                where: { id: 10 },
                data: expect.objectContaining({ count: 6 })
            });
        });

        it("should create new tag if not exists", async () => {
            vi.spyOn(strapi.db.query("api::global-tag.global-tag"), "findOne").mockResolvedValue(null);
            const createSpy = vi.spyOn(strapi.db.query("api::global-tag.global-tag"), "create");

            await service.syncGlobalTags(["new-tag"]);

            expect(createSpy).toHaveBeenCalledWith({
                data: expect.objectContaining({ name: "new-tag", count: 1 })
            });
        });
    });

    describe("updateUserInterests", () => {
        it("should orchestrate content fetch and user update", async () => {
            const docFindOneSpy = vi.spyOn(strapi.documents("api::article.article"), "findOne")
                .mockResolvedValue({ documentId: "art1", tags: ["tech"], engagement_score: 10 });

            const userUpdateSpy = vi.spyOn(strapi.db.query("plugin::users-permissions.user"), "update");

            await service.updateUserInterests(1, "art1", "article", "like");

            expect(docFindOneSpy).toHaveBeenCalled();
            expect(userUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    interest_map: expect.objectContaining({ tech: expect.any(Number) })
                })
            }));
        });
    });

    describe("applyTimeDecay (Batching Logic)", () => {
        it("should loop through batches until no more users are found", async () => {
            const findManySpy = vi.spyOn(strapi.db.query("plugin::users-permissions.user"), "findMany");

            // Mock returns 2 users first, then 0
            findManySpy
                .mockResolvedValueOnce([{ id: 1, interest_map: { a: 1 } }, { id: 2, interest_map: { b: 2 } }])
                .mockResolvedValueOnce([]);

            await service.applyTimeDecay(0.9, 2);

            expect(findManySpy).toHaveBeenCalledTimes(2);
            expect(findManySpy).toHaveBeenNthCalledWith(1, expect.objectContaining({ limit: 2, offset: 0 }));
            expect(findManySpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ limit: 2, offset: 2 }));
        });
    });

    describe("getFeed (Parallel Execution)", () => {
        it("should fetch candidates from all types in parallel", async () => {
            const docFindManySpy = vi.spyOn(strapi.documents("api::article.article"), "findMany");

            const user = { interest_map: { tech: 10 }, seen_history: [] };
            await service.getFeed(user, 10);

            // Verify findMany was called (it will be called for all contentTypes)
            expect(docFindManySpy).toHaveBeenCalled();
        });
    });
});
