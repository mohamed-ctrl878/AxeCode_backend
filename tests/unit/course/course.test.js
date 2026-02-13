import { describe, it, expect, vi, beforeEach } from 'vitest';
const StrapiMock = require('../../helpers/strapi-mock');

// Course service with stripSensitiveContent
const strapiMockForCourse = new StrapiMock();
const courseServiceFactory = require('../../../src/api/course/services/course');
const courseService = courseServiceFactory({ strapi: strapiMockForCourse });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('Course Service', () => {
  describe('enrichCourse', () => {
    it('should call facade and merge metrics', async () => {
        vi.spyOn(strapiMockForCourse, 'service').mockReturnValue({
            getFullDetails: async () => ({ price: 50, studentCount: 10, hasAccess: true, entitlementId: 'e-1' }),
            getMetadata: async () => ({})
        });

        const course = { documentId: 'c1', title: 'Test Course' };
        const enriched = await courseService.enrichCourse(course, 1);
        
        expect(enriched.price).toBe(50);
        expect(enriched.hasAccess).toBe(true);
        expect(enriched.entitlementsId).toBe('e-1');
    });

    it('should return null for null course', async () => {
        const result = await courseService.enrichCourse(null, 1);
        expect(result).toBeNull();
    });

    it('should grant publisher access even when facade returns false', async () => {
        const userId = 10;
        vi.spyOn(strapiMockForCourse, 'service').mockReturnValue({
            getFullDetails: async () => ({ price: 50, studentCount: 10, hasAccess: false, entitlementId: 'e-1' }),
            getMetadata: async () => ({})
        });

        const course = { documentId: 'c1', title: 'Test', users_permissions_user: { id: userId } };
        const enriched = await courseService.enrichCourse(course, userId);
        
        expect(enriched.hasAccess).toBe(true);
    });
  });

  describe('filterAndEnrichCourses', () => {
    it('should enrich multiple courses', async () => {
        vi.spyOn(strapiMockForCourse, 'service').mockReturnValue({
            getFullDetails: async () => ({ price: 0, hasAccess: true, studentCount: 5, entitlementId: 'e-1' }),
            getMetadata: async () => ({})
        });

        const courses = [
            { documentId: 'c1', title: 'Course 1' },
            { documentId: 'c2', title: 'Course 2' }
        ];
        const result = await courseService.filterAndEnrichCourses(courses, 1);
        expect(result).toHaveLength(2);
    });

    it('should handle empty array', async () => {
        const result = await courseService.filterAndEnrichCourses([], 1);
        expect(result).toHaveLength(0);
    });

    it('should handle null input', async () => {
        const result = await courseService.filterAndEnrichCourses(null, 1);
        expect(result).toHaveLength(0);
    });
  });

  describe('stripSensitiveContent', () => {
    const PAID_LESSON = {
      id: 1, documentId: 'l1', title: 'Paid Lesson', public: false,
      video: { url: '/uploads/secret.mp4' },
      description: [{ type: 'paragraph', children: [{ text: 'Premium content' }] }]
    };
    const FREE_LESSON = {
      id: 2, documentId: 'l2', title: 'Free Lesson', public: true,
      video: { url: '/uploads/free.mp4' },
      description: [{ type: 'paragraph', children: [{ text: 'Free content' }] }]
    };

    it('🟢 should keep all content when hasAccess is true', () => {
      const course = {
        hasAccess: true,
        weeks: [{ id: 1, lessons: [{ ...PAID_LESSON }, { ...FREE_LESSON }] }]
      };
      const result = courseService.stripSensitiveContent(course);
      expect(result.weeks[0].lessons[0].video).toBeDefined();
      expect(result.weeks[0].lessons[0].description).toBeDefined();
      expect(result.weeks[0].lessons[1].video).toBeDefined();
    });

    it('🟢 should strip video and description from paid lessons when hasAccess is false', () => {
      const course = {
        hasAccess: false,
        weeks: [{ id: 1, lessons: [{ ...PAID_LESSON }] }]
      };
      const result = courseService.stripSensitiveContent(course);
      expect(result.weeks[0].lessons[0].video).toBeUndefined();
      expect(result.weeks[0].lessons[0].description).toBeUndefined();
      // Metadata should still be present
      expect(result.weeks[0].lessons[0].title).toBe('Paid Lesson');
      expect(result.weeks[0].lessons[0].documentId).toBe('l1');
    });

    it('🟢 should keep free (public) lesson content even when hasAccess is false', () => {
      const course = {
        hasAccess: false,
        weeks: [{ id: 1, lessons: [{ ...FREE_LESSON }] }]
      };
      const result = courseService.stripSensitiveContent(course);
      expect(result.weeks[0].lessons[0].video).toBeDefined();
      expect(result.weeks[0].lessons[0].description).toBeDefined();
    });

    it('🟢 should correctly handle mixed paid and free lessons', () => {
      const course = {
        hasAccess: false,
        weeks: [{ id: 1, lessons: [{ ...PAID_LESSON }, { ...FREE_LESSON }] }]
      };
      const result = courseService.stripSensitiveContent(course);
      // Paid lesson stripped
      expect(result.weeks[0].lessons[0].video).toBeUndefined();
      expect(result.weeks[0].lessons[0].description).toBeUndefined();
      // Free lesson kept
      expect(result.weeks[0].lessons[1].video).toBeDefined();
      expect(result.weeks[0].lessons[1].description).toBeDefined();
    });

    it('🟢 should handle course without weeks gracefully', () => {
      const course = { hasAccess: false };
      const result = courseService.stripSensitiveContent(course);
      expect(result).toEqual(course);
    });

    it('🟢 should handle weeks without lessons gracefully', () => {
      const course = { hasAccess: false, weeks: [{ id: 1 }] };
      const result = courseService.stripSensitiveContent(course);
      expect(result.weeks[0].lessons).toBeUndefined();
    });
  });
});
