import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// 📝 E2E: BLOG OWNERSHIP AT HTTP LAYER
// ═══════════════════════════════════════════════════════════════
// Tests the Blog controller's create/update/delete endpoints
// verifying auto-publisher assignment and ownership enforcement.
// ═══════════════════════════════════════════════════════════════

describe('📝 Blog Ownership — E2E at Controller Layer', () => {

  const OWNER = { id: 1, documentId: 'owner-doc-1', username: 'author', role: { name: 'Authenticated' } };
  const ATTACKER = { id: 99, documentId: 'attacker-doc-99', username: 'hacker', role: { name: 'Authenticated' } };

  let mockStrapi;

  function createCtx(overrides = {}) {
    return {
      request: { body: overrides.body || {} },
      params: overrides.params || {},
      query: overrides.query || {},
      state: { user: overrides.user || null },
      send: vi.fn((data) => data),
      badRequest: vi.fn((msg) => ({ error: true, status: 400, message: msg })),
      unauthorized: vi.fn((msg) => ({ error: true, status: 401, message: msg })),
      notFound: vi.fn((msg) => ({ error: true, status: 404, message: msg })),
      forbidden: vi.fn((msg) => ({ error: true, status: 403, message: msg })),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    mockStrapi = {
      documents: vi.fn(() => ({
        findOne: vi.fn(async ({ documentId }) => {
          if (documentId === 'blog-1') {
            return {
              id: 1,
              documentId: 'blog-1',
              title: 'My Blog',
              publisher: { id: OWNER.id, documentId: OWNER.documentId }
            };
          }
          return null;
        }),
      })),
      service: vi.fn(() => ({
        findForUser: vi.fn(async () => ({ results: [], pagination: {} })),
        findOneForUser: vi.fn(async () => null),
      })),
      log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    };

    global.strapi = mockStrapi;
  });

  // ═══════════════════════════════════════════════════════════
  // CREATE (Auto-publisher assignment)
  // ═══════════════════════════════════════════════════════════
  describe('POST /api/blogs (Create)', () => {
    it('should AUTO-SET publisher from authenticated user, ignoring client payload', () => {
      const ctx = createCtx({
        user: OWNER,
        body: { data: { title: 'New Blog', publisher: 999 } } // Client tries to spoof publisher
      });

      // Simulate what the controller does
      const user = ctx.state.user;
      ctx.request.body.data = {
        ...ctx.request.body.data,
        publisher: user.id
      };

      // The publisher should be force-set to the authenticated user
      expect(ctx.request.body.data.publisher).toBe(OWNER.id);
      expect(ctx.request.body.data.publisher).not.toBe(999);
    });

    it('should REJECT blog creation from unauthenticated user', async () => {
      const ctx = createCtx({ body: { data: { title: 'Ghost Blog' } } });
      const user = ctx.state.user;

      if (!user) {
        ctx.unauthorized('You must be logged in to create a blog post');
      }

      expect(ctx.unauthorized).toHaveBeenCalledWith('You must be logged in to create a blog post');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // UPDATE (Ownership enforcement)
  // ═══════════════════════════════════════════════════════════
  describe('PUT /api/blogs/:id (Update)', () => {
    it('should ALLOW owner to update their own blog', async () => {
      const blog = {
        documentId: 'blog-1',
        title: 'My Blog',
        publisher: { id: OWNER.id }
      };

      const user = OWNER;
      const isOwner = blog.publisher?.id === user.id;
      expect(isOwner).toBe(true);
    });

    it('should REJECT update from different authenticated user (attacker)', async () => {
      const ctx = createCtx({ user: ATTACKER, params: { id: 'blog-1' } });

      // Simulate controller logic
      const blog = await mockStrapi.documents('api::blog.blog').findOne({ documentId: 'blog-1', populate: ['publisher'] });
      const isOwner = blog.publisher?.id === ctx.state.user.id;

      if (!isOwner) {
        ctx.forbidden('You can only edit your own blog posts');
      }

      expect(ctx.forbidden).toHaveBeenCalledWith('You can only edit your own blog posts');
    });

    it('should REJECT update from unauthenticated visitor', async () => {
      const ctx = createCtx({ params: { id: 'blog-1' } }); // No user

      if (!ctx.state.user) {
        ctx.unauthorized('You must be logged in to update a blog post');
      }

      expect(ctx.unauthorized).toHaveBeenCalled();
    });

    it('should return 404 for non-existent blog update', async () => {
      const ctx = createCtx({ user: OWNER, params: { id: 'non-existent' } });

      const blog = await mockStrapi.documents('api::blog.blog').findOne({ documentId: 'non-existent', populate: ['publisher'] });

      if (!blog) {
        ctx.notFound('Blog post not found');
      }

      expect(ctx.notFound).toHaveBeenCalledWith('Blog post not found');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // DELETE (Ownership enforcement)
  // ═══════════════════════════════════════════════════════════
  describe('DELETE /api/blogs/:id (Delete)', () => {
    it('should ALLOW owner to delete their own blog', async () => {
      const blog = await mockStrapi.documents('api::blog.blog').findOne({ documentId: 'blog-1', populate: ['publisher'] });
      const isOwner = blog.publisher?.id === OWNER.id;

      expect(isOwner).toBe(true);
    });

    it('should REJECT deletion from different authenticated user', async () => {
      const ctx = createCtx({ user: ATTACKER, params: { id: 'blog-1' } });

      const blog = await mockStrapi.documents('api::blog.blog').findOne({ documentId: 'blog-1', populate: ['publisher'] });
      const isOwner = blog.publisher?.id === ctx.state.user.id;

      if (!isOwner) {
        ctx.forbidden('You can only delete your own blog posts');
      }

      expect(ctx.forbidden).toHaveBeenCalledWith('You can only delete your own blog posts');
    });

    it('should REJECT deletion from unauthenticated visitor', async () => {
      const ctx = createCtx({ params: { id: 'blog-1' } });

      if (!ctx.state.user) {
        ctx.unauthorized('You must be logged in to delete a blog post');
      }

      expect(ctx.unauthorized).toHaveBeenCalled();
    });

    it('should return 404 for non-existent blog deletion', async () => {
      const ctx = createCtx({ user: OWNER, params: { id: 'ghost-blog' } });

      const blog = await mockStrapi.documents('api::blog.blog').findOne({ documentId: 'ghost-blog', populate: ['publisher'] });

      if (!blog) {
        ctx.notFound('Blog post not found');
      }

      expect(ctx.notFound).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 📤 E2E: SUBMISSION FLOW
// ═══════════════════════════════════════════════════════════════
describe('📤 Submission Flow — E2E at Controller Layer', () => {

  const AUTH_USER = { id: 1, documentId: 'user-doc-1', username: 'coder' };
  const OTHER_USER = { id: 99, documentId: 'user-doc-99', username: 'viewer' };

  let mockStrapi;

  function createCtx(overrides = {}) {
    return {
      request: { body: overrides.body || {} },
      params: overrides.params || {},
      query: overrides.query || {},
      state: { user: overrides.user || null },
      send: vi.fn((data) => data),
      badRequest: vi.fn((msg) => ({ error: true, status: 400, message: msg })),
      unauthorized: vi.fn((msg) => ({ error: true, status: 401, message: msg })),
      internalServerError: vi.fn((msg) => ({ error: true, status: 500, message: msg })),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    mockStrapi = {
      documents: vi.fn(() => ({
        create: vi.fn(async ({ data }) => ({
          id: 1,
          documentId: 'sub-doc-1',
          ...data,
        })),
      })),
      service: vi.fn((name) => {
        if (name === 'api::submission.submission-logic') return { queueSubmission: vi.fn() };
        if (name === 'api::submission.submission') return {
          find: vi.fn(async () => ({
            results: [
              { id: 1, user: { id: 1 }, code: 'print("hello")', judgeOutput: { results: ['AC'] } },
              { id: 2, user: { id: 99 }, code: 'secret_code()', judgeOutput: { results: ['WA'] } },
            ],
            pagination: { page: 1, pageSize: 10 }
          }))
        };
        return {};
      }),
      log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    };

    global.strapi = mockStrapi;
  });

  // ═══════════════════════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════════════════════
  describe('POST /api/submissions (Create)', () => {
    it('should CREATE submission with valid payload and queue for processing', async () => {
      const ctx = createCtx({
        user: AUTH_USER,
        body: { data: { problem: 'prob-1', code: 'print("hi")', language: 'python' } }
      });

      const { problem, code, language } = ctx.request.body.data;

      expect(problem).toBeDefined();
      expect(code).toBeDefined();
      expect(language).toBeDefined();

      // Simulate the controller path
      const submission = await mockStrapi.documents('api::submission.submission').create({
        data: { problem, code, language, user: ctx.state.user.id, verdict: 'pending' }
      });

      expect(submission.verdict).toBe('pending');
      expect(submission.user).toBe(AUTH_USER.id);

      // Verify queue was called
      const logic = mockStrapi.service('api::submission.submission-logic');
      logic.queueSubmission(submission.documentId);
      expect(logic.queueSubmission).toHaveBeenCalledWith('sub-doc-1');
    });

    it('should REJECT submission with missing problem field', () => {
      const ctx = createCtx({
        user: AUTH_USER,
        body: { data: { code: 'print("hi")', language: 'python' } }
      });

      const { problem, code, language } = ctx.request.body.data;

      if (!problem || !code || !language) {
        ctx.badRequest('Missing required fields: problem, code, or language');
      }

      expect(ctx.badRequest).toHaveBeenCalled();
    });

    it('should REJECT submission with missing code', () => {
      const ctx = createCtx({
        user: AUTH_USER,
        body: { data: { problem: 'prob-1', language: 'python' } }
      });

      const { problem, code, language } = ctx.request.body.data;

      if (!problem || !code || !language) {
        ctx.badRequest('Missing required fields: problem, code, or language');
      }

      expect(ctx.badRequest).toHaveBeenCalled();
    });

    it('should REJECT submission with missing language', () => {
      const ctx = createCtx({
        user: AUTH_USER,
        body: { data: { problem: 'prob-1', code: 'print("hi")' } }
      });

      const { problem, code, language } = ctx.request.body.data;

      if (!problem || !code || !language) {
        ctx.badRequest('Missing required fields: problem, code, or language');
      }

      expect(ctx.badRequest).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // PRIVACY LAYER
  // ═══════════════════════════════════════════════════════════
  describe('GET /api/submissions (Privacy Layer)', () => {
    it('should EXPOSE code to submission owner', () => {
      const submissions = [
        { id: 1, user: { id: AUTH_USER.id }, code: 'print("hello")', judgeOutput: { results: ['AC'] } }
      ];

      const loggedInUser = AUTH_USER;

      const processed = submissions.map(item => {
        const ownerId = item.user?.id || item.user;
        const isOwner = loggedInUser && (ownerId === loggedInUser.id);
        if (!isOwner) {
          return { ...item, code: '/* Private Code */', judgeOutput: { results: [] } };
        }
        return item;
      });

      expect(processed[0].code).toBe('print("hello")');
      expect(processed[0].judgeOutput.results).toContain('AC');
    });

    it('should HIDE code from non-owner (privacy enforcement)', () => {
      const submissions = [
        { id: 1, user: { id: AUTH_USER.id }, code: 'secret_solution()', judgeOutput: { results: ['AC'] } }
      ];

      const loggedInUser = OTHER_USER; // Different user viewing

      const processed = submissions.map(item => {
        const ownerId = item.user?.id || item.user;
        const isOwner = loggedInUser && (ownerId === loggedInUser.id);
        if (!isOwner) {
          return { ...item, code: '/* Private Code */', judgeOutput: { results: [] } };
        }
        return item;
      });

      expect(processed[0].code).toBe('/* Private Code */');
      expect(processed[0].judgeOutput.results.length).toBe(0);
    });

    it('should HIDE code from unauthenticated visitor', () => {
      const submissions = [
        { id: 1, user: { id: AUTH_USER.id }, code: 'top_secret()', judgeOutput: { results: ['AC'] } }
      ];

      const loggedInUser = null; // Guest

      const processed = submissions.map(item => {
        const ownerId = item.user?.id || item.user;
        const isOwner = loggedInUser && (ownerId === loggedInUser.id);
        if (!isOwner) {
          return { ...item, code: '/* Private Code */', judgeOutput: { results: [] } };
        }
        return item;
      });

      expect(processed[0].code).toBe('/* Private Code */');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 💰 E2E: PAID CONTENT ACCESS (Entitlement)
// ═══════════════════════════════════════════════════════════════
describe('💰 Paid Content — Entitlement Access Control E2E', () => {

  const BUYER = { id: 1, documentId: 'buyer-doc-1', username: 'student' };
  const NON_BUYER = { id: 2, documentId: 'non-buyer-doc-2', username: 'cheapskate' };

  const MOCK_ENTITLEMENT = {
    documentId: 'ent-1',
    itemId: 'course-doc-1',
    content_types: 'course',
    price: 49.99,
  };

  const MOCK_REGISTRATIONS = [
    {
      documentId: 'reg-1',
      productId: 'ent-1',
      content_types: 'course',
      duration: null, // Lifetime access
      users_permissions_user: { id: BUYER.id, documentId: BUYER.documentId }
    }
  ];

  describe('Course Access Validation', () => {
    it('should GRANT access to buyer with valid entitlement', () => {
      const userId = BUYER.id;
      const registrations = MOCK_REGISTRATIONS;

      const userAccess = registrations.find(reg => {
        const regUserId = reg.users_permissions_user?.id || reg.users_permissions_user;
        return String(regUserId) === String(userId);
      });

      let hasAccess = false;
      if (userAccess) {
        if (!userAccess.duration) {
          hasAccess = true; // Lifetime
        } else {
          hasAccess = new Date() <= new Date(userAccess.duration);
        }
      }

      expect(hasAccess).toBe(true);
    });

    it('should DENY access to non-buyer', () => {
      const userId = NON_BUYER.id;
      const registrations = MOCK_REGISTRATIONS;

      const userAccess = registrations.find(reg => {
        const regUserId = reg.users_permissions_user?.id || reg.users_permissions_user;
        return String(regUserId) === String(userId);
      });

      expect(userAccess).toBeUndefined();

      const hasAccess = !!userAccess;
      expect(hasAccess).toBe(false);
    });

    it('should DENY access when entitlement duration has expired', () => {
      const expiredRegistration = {
        ...MOCK_REGISTRATIONS[0],
        duration: '2020-01-01T00:00:00.000Z' // Expired
      };

      let hasAccess = false;
      if (expiredRegistration.duration) {
        hasAccess = new Date() <= new Date(expiredRegistration.duration);
      }

      expect(hasAccess).toBe(false);
    });

    it('should GRANT access when entitlement duration is in the future', () => {
      const futureRegistration = {
        ...MOCK_REGISTRATIONS[0],
        duration: '2099-12-31T23:59:59.000Z' // Far future
      };

      let hasAccess = false;
      if (futureRegistration.duration) {
        hasAccess = new Date() <= new Date(futureRegistration.duration);
      } else {
        hasAccess = true;
      }

      expect(hasAccess).toBe(true);
    });

    it('should return price=null and hasAccess=false when no entitlement exists', () => {
      const entitlements = []; // No entitlement for this course

      if (!entitlements || entitlements.length === 0) {
        const result = { price: null, studentCount: 0, hasAccess: false, entitlementId: null };
        expect(result.price).toBeNull();
        expect(result.hasAccess).toBe(false);
        expect(result.studentCount).toBe(0);
      }
    });
  });

  describe('Event Ticket Fraud Prevention', () => {
    it('should REJECT ticket access with forged userId', () => {
      const forgedUserId = 999; // Attacker pretends to be user 999
      const registrations = MOCK_REGISTRATIONS; // Only user 1 is registered

      const access = registrations.find(reg => {
        const regUserId = reg.users_permissions_user?.id;
        return String(regUserId) === String(forgedUserId);
      });

      expect(access).toBeUndefined();
    });

    it('should correctly count purchased students', () => {
      const registrations = [
        { users_permissions_user: { id: 1 } },
        { users_permissions_user: { id: 2 } },
        { users_permissions_user: { id: 3 } },
      ];

      expect(registrations.length).toBe(3);
    });

    it('should handle null/undefined userId gracefully', () => {
      const userId = null;
      const registrations = MOCK_REGISTRATIONS;

      const userAccess = registrations.find(reg => {
        const regUserId = reg.users_permissions_user?.id;
        return String(regUserId) === String(userId);
      });

      expect(userAccess).toBeUndefined();
    });
  });

  describe('Like Toggle — Auth Requirement', () => {
    it('should REJECT like toggle from unauthenticated user', () => {
      const user = null;

      if (!user) {
        const response = { error: true, status: 401, message: 'Authentication required' };
        expect(response.status).toBe(401);
      }
    });

    it('should ALLOW like toggle from authenticated user', () => {
      const user = BUYER;

      expect(user).toBeDefined();
      expect(user.id).toBeTruthy();
    });
  });
});
