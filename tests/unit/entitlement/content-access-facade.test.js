import { describe, it, expect, vi, beforeEach } from 'vitest';
const StrapiMock = require('../../helpers/strapi-mock');
const strapiMock = new StrapiMock();

const facadeFactory = require('../../../src/api/entitlement/services/content-access-facade');
const facade = facadeFactory({ strapi: strapiMock });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ContentAccessFacade Service', () => {
  describe('getFullDetails', () => {
    it('should return unified metrics object from entitlement service', async () => {
      const mockMetrics = {
        price: 99.99,
        studentCount: 1500,
        hasAccess: true,
        entitlementId: 'ent-123'
      };

      vi.spyOn(strapiMock, 'service').mockReturnValue({
        getMetricsAndAccess: async () => mockMetrics
      });

      const details = await facade.getFullDetails('doc-1', 'course', 1);
      expect(details.price).toBe(99.99);
      expect(details.studentCount).toBe(1500);
      expect(details.hasAccess).toBe(true);
    });
  });

  describe('enrichCollection', () => {
    it('should enrich multiple items with metrics', async () => {
      vi.spyOn(facade, 'getFullDetails').mockResolvedValue({
        price: 10,
        studentCount: 5,
        hasAccess: false,
        entitlementId: 'e-1'
      });

      const items = [{ documentId: 'd1' }, { documentId: 'd2' }];
      const enriched = await facade.enrichCollection(items, 'course', 1);
      
      expect(enriched[0].price).toBe(10);
      expect(enriched[1].student_count).toBe(5);
    });

    it('should grant hasAccess if user is the publisher', async () => {
        vi.spyOn(facade, 'getFullDetails').mockResolvedValue({
            price: 10,
            hasAccess: false
        });

        const items = [{ documentId: 'd1', users_permissions_user: { id: 1 } }];
        const enriched = await facade.enrichCollection(items, 'course', 1);
        
        expect(enriched[0].hasAccess).toBe(true);
    });
  });
});
