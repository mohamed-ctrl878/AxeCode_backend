import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// 🔒 PAID CONTENT SECURITY & ACCESS CONTROL TEST SUITE
// ═══════════════════════════════════════════════════════════════
// Covers: Authentication Bypass, Entitlement Spoofing,
// Data Leakage via Direct Access, and Content Masking.
// ═══════════════════════════════════════════════════════════════

describe('🔒 Paid Content Integrity & Fraud Prevention', () => {

  const AUTHENTICATED_BUYER = { id: 10, documentId: 'buyer-user' };
  const EXPIRED_BUYER       = { id: 11, documentId: 'expired-user' };
  const ATTACKER_USER       = { id: 99, documentId: 'attacker-user' };
  const PUBLISHER_USER      = { id: 1,  documentId: 'publisher-user' };
  const UNAUTHENTICATED     = null;

  let mockStrapi;
  let facadeService;
  let courseService;
  let eventLogicService;

  beforeEach(() => {
    vi.clearAllMocks();

    // 1. Mock the Content Access Facade (Central Source of Truth for Paid Access)
    facadeService = {
      getFullDetails: vi.fn(async (documentId, type, userId) => {
        // Evaluate fraud rules and mock database returns
        if (!userId) return { hasAccess: false, price: 99.99, studentCount: 50 };
        if (userId === AUTHENTICATED_BUYER.id) return { hasAccess: true, price: 99.99, studentCount: 51, entitlementId: 1 };
        if (userId === EXPIRED_BUYER.id) return { hasAccess: false, price: 99.99, studentCount: 51 }; // Expired!
        return { hasAccess: false, price: 99.99, studentCount: 50 }; // Attacker
      }),
      enrichCollection: vi.fn(async (items, type, userId) => {
        return Promise.all(items.map(async item => {
          const details = await facadeService.getFullDetails(item.documentId, type, userId);
          return { ...item, hasAccess: details.hasAccess, price: details.price };
        }));
      })
    };

    // 2. Mock Global Strapi Environment
    mockStrapi = {
      contentType: vi.fn(() => ({ attributes: {} })),
      service: vi.fn((name) => {
        if (name === 'api::entitlement.content-access-facade') return facadeService;
        if (name === 'api::rate.interaction-facade') return { getMetadata: vi.fn().mockResolvedValue({}) };
        return {};
      }),
      documents: vi.fn(() => ({
        findMany: vi.fn().mockResolvedValue([]),
      })),
      db: {
        query: vi.fn(() => ({
          findMany: vi.fn().mockResolvedValue([{ id: 1, duration: 300 }]), // Mock Lessons
        }))
      },
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    };

    // Initialize Services with Mocked Strapi
    courseService = require('../../../src/api/course/services/course')({ strapi: mockStrapi });
    eventLogicService = require('../../../src/api/event/services/event-logic')({ strapi: mockStrapi });
  });

  describe('🎟️ EVENT: Content Access Integration', () => {

    it('should BLOCK access (hasAccess = false) for unauthenticated visitors', async () => {
      const mockEvent = { documentId: 'event-101', title: 'Private Webinar' };
      await eventLogicService.enrichMetrics(mockEvent, UNAUTHENTICATED);
      
      expect(mockEvent.hasAccess).toBe(false);
      expect(mockEvent.price).toBe(99.99); // Price is still visible
      expect(facadeService.getFullDetails).toHaveBeenCalledWith('event-101', 'event', null);
    });

    it('should GRANT access for buyers with valid entitlements', async () => {
      const mockEvent = { documentId: 'event-101' };
      await eventLogicService.enrichMetrics(mockEvent, AUTHENTICATED_BUYER.id);
      
      expect(mockEvent.hasAccess).toBe(true);
      expect(mockEvent.entitlementsId).toBe(1);
    });

    it('should BLOCK access for users with expired entitlements', async () => {
      const mockEvent = { documentId: 'event-101' };
      // User bought it but duration expired
      await eventLogicService.enrichMetrics(mockEvent, EXPIRED_BUYER.id);
      
      expect(mockEvent.hasAccess).toBe(false);
    });

    it('should BLOCK access for an attacker trying to view the private stream', async () => {
      const mockEvent = { documentId: 'event-101' };
      await eventLogicService.enrichMetrics(mockEvent, ATTACKER_USER.id);
      
      expect(mockEvent.hasAccess).toBe(false);
    });

    it('should ALWAYS GRANT access to the event Publisher (Fraud prevention bypasses do not apply to content owners)', async () => {
      const mockEvent = { 
        documentId: 'event-101', 
        users_permissions_user: { id: PUBLISHER_USER.id } // Owner declaration
      };
      // The facade returns FALSE because publishers don't "buy" their own events (no entitlement)
      // The event logic MUST catch this and override it to TRUE
      await eventLogicService.enrichMetrics(mockEvent, PUBLISHER_USER.id);
      expect(mockEvent.hasAccess).toBe(true);
    });

  });

  describe('📚 COURSE: Advanced Data Masking & Fraud Prevention', () => {

    let mockCourse;

    beforeEach(() => {
      mockCourse = {
        documentId: 'course-1',
        title: 'Advanced System Design',
        weeks: [
          {
            title: 'Week 1 - Intro',
            lessons: [
              { documentId: 'L1', title: 'Public Intro', public: true, video: 'https://vimeo.com/public1', description: 'Free' },
              { documentId: 'L2', title: 'Private Secrets', public: false, video: 'https://vimeo.com/secret1', description: 'Paid' }
            ]
          }
        ]
      };
    });

    it('VULNERABILITY CHECK: should STRIP sensitive video/description if Attacker triggers findOne', async () => {
      const result = await courseService.enrichCourse(mockCourse, ATTACKER_USER.id);
      
      expect(result.hasAccess).toBe(false);

      const publicLesson = result.weeks[0].lessons[0];
      const privateLesson = result.weeks[0].lessons[1];

      // Public lesson remains intact
      expect(publicLesson.video).toBe('https://vimeo.com/public1');
      
      // 🔒 SENSITIVE DATA LEAK PREVENTION 🔒
      // The attacker's response payload should be forcibly stripped of private data
      expect(privateLesson.video).toBeUndefined();
      expect(privateLesson.description).toBeUndefined();
      // Safe metadata remains
      expect(privateLesson.title).toBe('Private Secrets'); 
    });

    it('should EXPOSE sensitive video data ONLY to authenticated buyers', async () => {
      const result = await courseService.enrichCourse(mockCourse, AUTHENTICATED_BUYER.id);
      
      expect(result.hasAccess).toBe(true);
      const privateLesson = result.weeks[0].lessons[1];

      // Buyer has access, payload remains intact
      expect(privateLesson.video).toBe('https://vimeo.com/secret1');
      expect(privateLesson.description).toBe('Paid');
    });

    it('should EXPOSE sensitive video data to the Publisher (even without an entitlement)', async () => {
      // Publisher owns it
      mockCourse.users_permissions_user = { id: PUBLISHER_USER.id };
      
      const result = await courseService.enrichCourse(mockCourse, PUBLISHER_USER.id);
      
      expect(result.hasAccess).toBe(true);
      const privateLesson = result.weeks[0].lessons[1];

      // Publisher inherently has access
      expect(privateLesson.video).toBe('https://vimeo.com/secret1');
    });

    it('VULNERABILITY CHECK: Collection Enumeration (findMany) strips private data for unauthenticated lists', async () => {
      const courses = [mockCourse];
      // When a guest loads the course feed /api/courses
      const result = await courseService.filterAndEnrichCourses(courses, UNAUTHENTICATED);
      
      const courseOne = result[0];
      expect(courseOne.hasAccess).toBe(false);
      
      // Prove that listing courses doesn't leak nested private lesson videos
      expect(courseOne.weeks[0].lessons[1].video).toBeUndefined();
    });

  });
});
