'use strict';

import { describe, it, expect, vi, beforeEach } from 'vitest';
const StrapiMock = require('../../helpers/strapi-mock');

/**
 * Paid Lesson Security Audit Tests
 * 
 * هذه الاختبارات تختبر مدى أمان حماية الدروس المدفوعة في النظام.
 * كل اختبار يوثق سلوك النظام الحالي ويحدد ما إذا كان آمناً أم لا.
 * 
 * Legend:
 *   🔴 VULNERABILITY  = ثغرة أمنية مؤكدة
 *   🟢 SECURE         = سلوك آمن
 */

// ──────────────────────────────────────────────
// Setup: Course Service
// ──────────────────────────────────────────────
const strapiMockForCourse = new StrapiMock();
const courseServiceFactory = require('../../../src/api/course/services/course');
const courseService = courseServiceFactory({ strapi: strapiMockForCourse });

// ──────────────────────────────────────────────
// Setup: Lesson Service
// ──────────────────────────────────────────────
const strapiMockForLesson = new StrapiMock();
const lessonServiceFactory = require('../../../src/api/lesson/services/lesson');
const lessonService = lessonServiceFactory({ strapi: strapiMockForLesson });

// ──────────────────────────────────────────────
// Setup: Entitlement Service
// ──────────────────────────────────────────────
const strapiMockForEntitlement = new StrapiMock();
const entitlementServiceFactory = require('../../../src/api/entitlement/services/entitlement');
const entitlementService = entitlementServiceFactory({ strapi: strapiMockForEntitlement });

// ──────────────────────────────────────────────
// Test Data Fixtures
// ──────────────────────────────────────────────

/** درس مدفوع يحتوي على فيديو ووصف */
const PAID_LESSON = {
  id: 1,
  documentId: 'lesson-paid-1',
  title: 'Advanced Data Structures',
  public: false,
  publishedAt: '2025-06-01T00:00:00Z',
  video: {
    id: 10,
    url: '/uploads/paid_video_secret_content.mp4',
    name: 'paid_video_secret_content.mp4',
    mime: 'video/mp4',
  },
  description: [
    { type: 'paragraph', children: [{ type: 'text', text: 'This is premium lesson content about advanced data structures.' }] }
  ],
  users_permissions_user: { id: 5, username: 'publisher_user' },
};

/** درس مجاني (public) */
const FREE_LESSON = {
  id: 2,
  documentId: 'lesson-free-1',
  title: 'Introduction to Programming',
  public: true,
  publishedAt: '2025-06-01T00:00:00Z',
  video: {
    id: 20,
    url: '/uploads/free_intro_video.mp4',
    name: 'free_intro_video.mp4',
    mime: 'video/mp4',
  },
  description: [
    { type: 'paragraph', children: [{ type: 'text', text: 'This is a free introductory lesson.' }] }
  ],
  users_permissions_user: { id: 5, username: 'publisher_user' },
};

/** كورس يحتوي على أسابيع ودروس مدفوعة */
const PAID_COURSE = {
  documentId: 'course-1',
  title: 'Premium Algorithm Course',
  publishedAt: '2025-06-01T00:00:00Z',
  users_permissions_user: { id: 5, username: 'publisher_user' },
  weeks: [
    {
      id: 1,
      publishedAt: '2025-06-01T00:00:00Z',
      users_permissions_user: { id: 5 },
      lessons: [
        { ...PAID_LESSON },
        { ...FREE_LESSON },
      ]
    }
  ]
};

const PUBLISHER_USER_ID = 5;
const REGULAR_USER_ID = 99;    // مستخدم مسجّل بدون entitlement
const ENTITLED_USER_ID = 100;  // مستخدم مسجّل لديه entitlement

// ══════════════════════════════════════════════════════
// 1. Course Service - enrichCourse Security Tests
// ══════════════════════════════════════════════════════

describe('🔒 Paid Lesson Security Audit', () => {

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ──────────────────────────────────────────────
  // 1.1: enrichCourse - Content Exposure Tests
  // ──────────────────────────────────────────────
  describe('Course Service - enrichCourse', () => {

    it('🟢 FIXED: enrichCourse strips video/description when hasAccess is false', async () => {
      vi.spyOn(strapiMockForCourse, 'service').mockReturnValue({
        getFullDetails: async () => ({
          price: 150,
          studentCount: 50,
          hasAccess: false,
          entitlementId: 'ent-1'
        }),
        getMetadata: async () => ({})
      });

      const result = await courseService.enrichCourse(
        { ...PAID_COURSE },
        REGULAR_USER_ID
      );

      // ✅ hasAccess is false
      expect(result.hasAccess).toBe(false);

      // 🟢 FIXED: Paid lesson content is now STRIPPED
      const paidLesson = result.weeks[0].lessons[0];
      expect(paidLesson.video).toBeUndefined();
      expect(paidLesson.description).toBeUndefined();
      expect(paidLesson.title).toBeDefined(); // metadata still present

      // 🟢 Free lesson content is preserved
      const freeLesson = result.weeks[0].lessons[1];
      expect(freeLesson.video).toBeDefined();
      expect(freeLesson.description).toBeDefined();
    });

    it('🟢 SECURE: Publisher always has full access to their own course content', async () => {
      vi.spyOn(strapiMockForCourse, 'service').mockReturnValue({
        getFullDetails: async () => ({
          price: 150,
          studentCount: 50,
          hasAccess: false,
          entitlementId: 'ent-1'
        }),
        getMetadata: async () => ({})
      });

      const result = await courseService.enrichCourse(
        { ...PAID_COURSE },
        PUBLISHER_USER_ID
      );

      expect(result.hasAccess).toBe(true);
      expect(result.weeks[0].lessons[0].video).toBeDefined();
    });

    it('🟢 SECURE: Entitled user gets hasAccess: true', async () => {
      vi.spyOn(strapiMockForCourse, 'service').mockReturnValue({
        getFullDetails: async () => ({
          price: 150,
          studentCount: 50,
          hasAccess: true,
          entitlementId: 'ent-1'
        }),
        getMetadata: async () => ({})
      });

      const result = await courseService.enrichCourse(
        { ...PAID_COURSE },
        ENTITLED_USER_ID
      );

      expect(result.hasAccess).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // 2: Lesson Service - Direct Access Tests
  // ──────────────────────────────────────────────
  describe('Lesson Service - Direct Access (enrichLesson)', () => {

    it('🔴 VULNERABILITY: enrichLesson returns full content without checking entitlement', async () => {
      vi.spyOn(strapiMockForLesson, 'service').mockReturnValue({
        getMetadata: async () => ({
          likes: 0,
          comments: 0,
          userHasLiked: false
        })
      });

      const result = await lessonService.enrichLesson(
        { ...PAID_LESSON },
        REGULAR_USER_ID
      );

      // 🔴 الفيديو والوصف يُرجعان بدون تحقق من entitlement
      expect(result.video).toBeDefined();
      expect(result.video.url).toBe('/uploads/paid_video_secret_content.mp4');
      expect(result.description).toBeDefined();
      expect(result.interactions).toBeDefined();
      expect(result.hasAccess).toBeUndefined();
    });

    it('🔴 VULNERABILITY: enrichLesson does not differentiate between public and private lessons', async () => {
      vi.spyOn(strapiMockForLesson, 'service').mockReturnValue({
        getMetadata: async () => ({})
      });

      const paidResult = await lessonService.enrichLesson({ ...PAID_LESSON }, REGULAR_USER_ID);
      const freeResult = await lessonService.enrichLesson({ ...FREE_LESSON }, REGULAR_USER_ID);

      expect(paidResult.video).toBeDefined();
      expect(freeResult.video).toBeDefined();
      expect(paidResult.public).toBe(false);
      expect(freeResult.public).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // 3: Entitlement Service - Core Logic Tests
  // ──────────────────────────────────────────────
  describe('Entitlement Service - getMetricsAndAccess', () => {

    it('🟢 SECURE: Returns hasAccess: false for user without entitlement', async () => {
      vi.spyOn(strapiMockForEntitlement, 'documents').mockReturnValue({
        findMany: vi.fn()
          .mockResolvedValueOnce([{
            documentId: 'ent-1',
            price: 150,
            itemId: 'course-1',
            content_types: 'course'
          }])
          .mockResolvedValueOnce([])
      });

      const result = await entitlementService.getMetricsAndAccess(
        'course-1', 'course', REGULAR_USER_ID
      );

      expect(result.hasAccess).toBe(false);
      expect(result.price).toBe(150);
      expect(result.studentCount).toBe(0);
    });

    it('🟢 SECURE: Returns hasAccess: true for user with valid entitlement', async () => {
      vi.spyOn(strapiMockForEntitlement, 'documents').mockReturnValue({
        findMany: vi.fn()
          .mockResolvedValueOnce([{
            documentId: 'ent-1',
            price: 150,
            itemId: 'course-1',
            content_types: 'course'
          }])
          .mockResolvedValueOnce([{
            documentId: 'ue-1',
            users_permissions_user: { id: ENTITLED_USER_ID },
            duration: null,
            productId: 'ent-1',
            content_types: 'course'
          }])
      });

      const result = await entitlementService.getMetricsAndAccess(
        'course-1', 'course', ENTITLED_USER_ID
      );

      expect(result.hasAccess).toBe(true);
      expect(result.studentCount).toBe(1);
    });

    it('🟢 SECURE: Returns hasAccess: false for expired entitlement', async () => {
      const expiredDate = new Date('2024-01-01').toISOString();

      vi.spyOn(strapiMockForEntitlement, 'documents').mockReturnValue({
        findMany: vi.fn()
          .mockResolvedValueOnce([{
            documentId: 'ent-1',
            price: 150,
            itemId: 'course-1',
            content_types: 'course'
          }])
          .mockResolvedValueOnce([{
            documentId: 'ue-1',
            users_permissions_user: { id: ENTITLED_USER_ID },
            duration: expiredDate,
            productId: 'ent-1',
            content_types: 'course'
          }])
      });

      const result = await entitlementService.getMetricsAndAccess(
        'course-1', 'course', ENTITLED_USER_ID
      );

      expect(result.hasAccess).toBe(false);
    });

    it('🟢 SECURE: Returns hasAccess: false when no entitlement exists', async () => {
      vi.spyOn(strapiMockForEntitlement, 'documents').mockReturnValue({
        findMany: vi.fn().mockResolvedValueOnce([])
      });

      const result = await entitlementService.getMetricsAndAccess(
        'course-nonexistent', 'course', REGULAR_USER_ID
      );

      expect(result.hasAccess).toBe(false);
      expect(result.price).toBeNull();
      expect(result.entitlementId).toBeNull();
    });

    it('🟢 SECURE: Returns hasAccess: false for unauthenticated user', async () => {
      vi.spyOn(strapiMockForEntitlement, 'documents').mockReturnValue({
        findMany: vi.fn()
          .mockResolvedValueOnce([{
            documentId: 'ent-1',
            price: 150,
            itemId: 'course-1',
            content_types: 'course'
          }])
          .mockResolvedValueOnce([{
            documentId: 'ue-1',
            users_permissions_user: { id: ENTITLED_USER_ID },
            duration: null,
            productId: 'ent-1',
            content_types: 'course'
          }])
      });

      const result = await entitlementService.getMetricsAndAccess(
        'course-1', 'course', null
      );

      expect(result.hasAccess).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // 4: Attack Vector Simulation
  // ──────────────────────────────────────────────
  describe('Attack Vector Simulation', () => {

    it('🟢 FIXED: Attacker CANNOT extract paid video URL from course response', async () => {
      vi.spyOn(strapiMockForCourse, 'service').mockReturnValue({
        getFullDetails: async () => ({
          price: 200,
          studentCount: 100,
          hasAccess: false,
          entitlementId: 'ent-1'
        }),
        getMetadata: async () => ({})
      });

      const attackerCourseView = await courseService.enrichCourse(
        { ...PAID_COURSE },
        REGULAR_USER_ID
      );

      const extractedVideoUrls = [];
      for (const week of attackerCourseView.weeks) {
        for (const lesson of week.lessons) {
          if (lesson.video?.url && !lesson.public) {
            extractedVideoUrls.push(lesson.video.url);
          }
        }
      }

      // 🟢 No paid video URLs extracted!
      expect(extractedVideoUrls).not.toContain('/uploads/paid_video_secret_content.mp4');
      expect(extractedVideoUrls).toHaveLength(0);
    });

    it('🔴 ATTACK: Attacker bypasses frontend protection via direct API call', async () => {
      vi.spyOn(strapiMockForLesson, 'service').mockReturnValue({
        getMetadata: async () => ({})
      });

      const directAccessResult = await lessonService.enrichLesson(
        { ...PAID_LESSON },
        REGULAR_USER_ID
      );

      expect(directAccessResult.video).toBeDefined();
      expect(directAccessResult.video.url).toBe('/uploads/paid_video_secret_content.mp4');
      expect(directAccessResult.description).toBeDefined();
      expect(directAccessResult.description[0].children[0].text).toContain('premium lesson content');
    });
  });
});
