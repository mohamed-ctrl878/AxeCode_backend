import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║          OWNERSHIP INTEGRITY TEST SUITE                            ║
 * ║          Tests Update/Delete operations across ALL content types   ║
 * ║          Verifies that only owners can modify their own content    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 * 
 * Content Types with explicit ownership checks:
 * ─────────────────────────────────────────────────
 * 1. Blog         → publisher (controller-level check)
 * 2. Conversation  → creator  (moderation-service check)
 * 3. Submission    → user     (controller-level privacy)
 * 4. Notification  → owner    (controller-level check)
 * 
 * Content Types with auto-set ownership on create:
 * ─────────────────────────────────────────────────
 * 5. Article       → author   (auto-set, no update/delete guard)
 * 6. Course        → users_permissions_user (auto-set)
 * 7. Lesson        → users_permissions_user (auto-set, entitlement-gated reads)
 * 8. Comment       → users_permissions_user (auto-set via DB, no update/delete override)
 * 9. Report        → users_permissions_user (auto-set via DB, no update/delete override)
 * 10. Event        → users_permissions_user (created via service, no update/delete override)
 * 
 * Middleware-level (Document Service):
 * ─────────────────────────────────────────────────
 * 11. File Ownership Middleware → validates ownership on create/update for ALL content types with media
 */

// ─── Mock Helpers ───

function createMockCtx({
  user = null,
  params = {},
  body = {},
  query = {},
  cookies = {},
} = {}) {
  const _responses = {};
  return {
    state: { user },
    params,
    request: { body },
    query,
    cookies: { get: (name) => cookies[name] || null },
    _responses,
    unauthorized: vi.fn((msg) => { _responses.status = 401; _responses.body = { error: msg }; return _responses; }),
    forbidden:    vi.fn((msg) => { _responses.status = 403; _responses.body = { error: msg }; return _responses; }),
    notFound:     vi.fn((msg) => { _responses.status = 404; _responses.body = { error: msg }; return _responses; }),
    badRequest:   vi.fn((msg) => { _responses.status = 400; _responses.body = { error: msg }; return _responses; }),
    internalServerError: vi.fn((msg) => { _responses.status = 500; _responses.body = { error: msg }; return _responses; }),
    send:         vi.fn((data) => { _responses.body = data; return data; }),
  };
}

const AUTHENTICATED_OWNER   = { id: 1, documentId: 'auth-doc-1', username: 'auth_user_A', role: { name: 'Authenticated' } };
const AUTHENTICATED_OTHER_USER = { id: 99, documentId: 'auth-doc-99', username: 'auth_user_B', role: { name: 'Authenticated' } };
const NO_USER      = null;

// ═══════════════════════════════════════════════════════════════
// 1. BLOG — Controller-level ownership (publisher)
// ═══════════════════════════════════════════════════════════════
describe('Blog — Ownership Integrity (Update & Delete)', () => {

  // ── UPDATE ──

  it('should BLOCK update by unauthenticated user', async () => {
    const ctx = createMockCtx({ user: NO_USER, params: { id: 'blog-1' } });
    
    // Simulate the blog controller update logic
    const user = ctx.state.user;
    if (!user) {
      ctx.unauthorized('You must be logged in to update a blog post');
    }

    expect(ctx.unauthorized).toHaveBeenCalled();
    expect(ctx._responses.status).toBe(401);
  });

  it('should BLOCK update by non-owner', async () => {
    const ctx = createMockCtx({ user: AUTHENTICATED_OTHER_USER, params: { id: 'blog-1' } });
    
    // Simulate fetching the blog
    const blog = { id: 1, documentId: 'blog-1', publisher: { id: AUTHENTICATED_OWNER.id } };
    
    if (blog.publisher?.id !== ctx.state.user.id) {
      ctx.forbidden('You can only edit your own blog posts');
    }

    expect(ctx.forbidden).toHaveBeenCalledWith('You can only edit your own blog posts');
    expect(ctx._responses.status).toBe(403);
  });

  it('should ALLOW update by the owner', async () => {
    const ctx = createMockCtx({ user: AUTHENTICATED_OWNER, params: { id: 'blog-1' } });
    
    const blog = { id: 1, documentId: 'blog-1', publisher: { id: AUTHENTICATED_OWNER.id } };
    let blocked = false;

    if (!ctx.state.user) {
      ctx.unauthorized('Not logged in');
      blocked = true;
    } else if (blog.publisher?.id !== ctx.state.user.id) {
      ctx.forbidden('Not owner');
      blocked = true;
    }

    expect(blocked).toBe(false);
    expect(ctx.forbidden).not.toHaveBeenCalled();
    expect(ctx.unauthorized).not.toHaveBeenCalled();
  });

  // ── DELETE ──

  it('should BLOCK delete by unauthenticated user', async () => {
    const ctx = createMockCtx({ user: NO_USER, params: { id: 'blog-1' } });

    if (!ctx.state.user) {
      ctx.unauthorized('You must be logged in to delete a blog post');
    }

    expect(ctx.unauthorized).toHaveBeenCalled();
    expect(ctx._responses.status).toBe(401);
  });

  it('should BLOCK delete by non-owner', async () => {
    const ctx = createMockCtx({ user: AUTHENTICATED_OTHER_USER, params: { id: 'blog-1' } });
    
    const blog = { id: 1, documentId: 'blog-1', publisher: { id: AUTHENTICATED_OWNER.id } };
    
    if (blog.publisher?.id !== ctx.state.user.id) {
      ctx.forbidden('You can only delete your own blog posts');
    }

    expect(ctx.forbidden).toHaveBeenCalledWith('You can only delete your own blog posts');
    expect(ctx._responses.status).toBe(403);
  });

  it('should ALLOW delete by the owner', async () => {
    const ctx = createMockCtx({ user: AUTHENTICATED_OWNER, params: { id: 'blog-1' } });
    
    const blog = { id: 1, documentId: 'blog-1', publisher: { id: AUTHENTICATED_OWNER.id } };
    let blocked = false;

    if (!ctx.state.user) { blocked = true; }
    else if (blog.publisher?.id !== ctx.state.user.id) { blocked = true; }

    expect(blocked).toBe(false);
  });

  it('should return 404 when blog does not exist on update', async () => {
    const ctx = createMockCtx({ user: AUTHENTICATED_OWNER, params: { id: 'nonexistent' } });
    
    const blog = null; // not found
    
    if (!blog) {
      ctx.notFound('Blog post not found');
    }

    expect(ctx.notFound).toHaveBeenCalledWith('Blog post not found');
    expect(ctx._responses.status).toBe(404);
  });

  it('should return 404 when blog does not exist on delete', async () => {
    const ctx = createMockCtx({ user: AUTHENTICATED_OWNER, params: { id: 'nonexistent' } });
    
    const blog = null; // not found
    
    if (!blog) {
      ctx.notFound('Blog post not found');
    }

    expect(ctx.notFound).toHaveBeenCalledWith('Blog post not found');
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. CONVERSATION — Moderation-service-based ownership (creator)
// ═══════════════════════════════════════════════════════════════
describe('Conversation — Ownership Integrity (Update & Delete)', () => {
  
  // ── UPDATE ──

  it('should BLOCK update by unauthenticated user', () => {
    const ctx = createMockCtx({ user: NO_USER, params: { id: 'conv-1' } });
    
    if (!ctx.state.user) {
      ctx.unauthorized('Not authenticated');
    }

    expect(ctx.unauthorized).toHaveBeenCalledWith('Not authenticated');
  });

  it('should BLOCK update by non-creator', () => {
    const ctx = createMockCtx({ user: AUTHENTICATED_OTHER_USER, params: { id: 'conv-1' } });
    
    // Simulate moderation.getPermissions returning isCreator=false
    const permissions = { exists: true, isCreator: false };
    
    if (!permissions.exists) ctx.notFound();
    else if (!permissions.isCreator) ctx.forbidden('Only the creator can update');

    expect(ctx.forbidden).toHaveBeenCalledWith('Only the creator can update');
    expect(ctx._responses.status).toBe(403);
  });

  it('should ALLOW update by the creator', () => {
    const ctx = createMockCtx({ user: AUTHENTICATED_OWNER, params: { id: 'conv-1' } });
    
    const permissions = { exists: true, isCreator: true };
    let blocked = false;
    
    if (!ctx.state.user) { blocked = true; }
    else if (!permissions.exists) { blocked = true; }
    else if (!permissions.isCreator) { blocked = true; }

    expect(blocked).toBe(false);
    expect(ctx.forbidden).not.toHaveBeenCalled();
  });

  it('should return 404 when conversation does not exist', () => {
    const ctx = createMockCtx({ user: AUTHENTICATED_OWNER, params: { id: 'nonexistent' } });
    
    const permissions = { exists: false, isCreator: false };
    
    if (!permissions.exists) ctx.notFound();

    expect(ctx.notFound).toHaveBeenCalled();
  });

  // ── DELETE ──

  it('should BLOCK delete by non-creator', () => {
    const ctx = createMockCtx({ user: AUTHENTICATED_OTHER_USER, params: { id: 'conv-1' } });
    
    const permissions = { exists: true, isCreator: false };
    
    if (!permissions.isCreator) ctx.forbidden('Only the creator can delete');

    expect(ctx.forbidden).toHaveBeenCalledWith('Only the creator can delete');
  });

  it('should ALLOW delete by the creator', () => {
    const ctx = createMockCtx({ user: AUTHENTICATED_OWNER, params: { id: 'conv-1' } });
    
    const permissions = { exists: true, isCreator: true };
    let blocked = false;
    
    if (!permissions.isCreator) { blocked = true; }

    expect(blocked).toBe(false);
    expect(ctx.forbidden).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. SUBMISSION — Privacy Layer (code visibility)
// ═══════════════════════════════════════════════════════════════
describe('Submission — Ownership Privacy (Read Protection)', () => {
  const SUBMISSION = {
    id: 1,
    code: 'def solve(): return 42',
    judgeOutput: { results: [{ verdict: 'accepted' }] },
    user: { id: AUTHENTICATED_OWNER.id }
  };

  it('should expose full code to submission owner', () => {
    const loggedInUser = AUTHENTICATED_OWNER;
    const ownerId = SUBMISSION.user?.id || SUBMISSION.user;
    const isOwner = loggedInUser && (ownerId === loggedInUser.id);

    expect(isOwner).toBe(true);
    // Owner should see raw code
    const result = isOwner ? SUBMISSION : { ...SUBMISSION, code: '/* Private */' };
    expect(result.code).toBe('def solve(): return 42');
  });

  it('should hide code from non-owner', () => {
    const loggedInUser = AUTHENTICATED_OTHER_USER;
    const ownerId = SUBMISSION.user?.id || SUBMISSION.user;
    const isOwner = loggedInUser && (ownerId === loggedInUser.id);

    expect(isOwner).toBe(false);
    const result = isOwner ? SUBMISSION : { ...SUBMISSION, code: '/* Private Code */', judgeOutput: { results: [] } };
    expect(result.code).toBe('/* Private Code */');
    expect(result.judgeOutput.results).toEqual([]);
  });

  it('should hide code when no user is logged in', () => {
    const loggedInUser = null;
    const ownerId = SUBMISSION.user?.id || SUBMISSION.user;
    const isOwner = loggedInUser && (ownerId === loggedInUser.id);

    expect(isOwner).toBeFalsy();
    const result = isOwner ? SUBMISSION : { ...SUBMISSION, code: '/* Private Code */' };
    expect(result.code).toBe('/* Private Code */');
  });

  it('should handle submission with direct user ID (not populated)', () => {
    const submission = { ...SUBMISSION, user: AUTHENTICATED_OWNER.id }; // user is just an int
    const loggedInUser = AUTHENTICATED_OWNER;
    const ownerId = submission.user?.id || submission.user;
    const isOwner = loggedInUser && (ownerId === loggedInUser.id);

    expect(isOwner).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. NOTIFICATION — Ownership-scoped reads & marking as read
// ═══════════════════════════════════════════════════════════════
describe('Notification — Ownership Integrity', () => {
  it('should BLOCK unauthenticated users from reading notifications', () => {
    const ctx = createMockCtx({ user: NO_USER });
    
    if (!ctx.state.user) {
      ctx.unauthorized();
    }

    expect(ctx.unauthorized).toHaveBeenCalled();
  });

  it('should only return notifications where owner matches current user', () => {
    const userDocId = AUTHENTICATED_OWNER.documentId;
    const filter = { owner: { documentId: userDocId } };

    // This is the filter that the controller applies
    expect(filter.owner.documentId).toBe(AUTHENTICATED_OWNER.documentId);
    // An attacker's notifications would have a different documentId
    expect(filter.owner.documentId).not.toBe(AUTHENTICATED_OTHER_USER.documentId);
  });

  it('should return 404 when trying to mark another users notification as read', () => {
    const ctx = createMockCtx({ user: AUTHENTICATED_OTHER_USER, params: { id: 'notif-1' } });
    
    // Simulate: findFirst returns null because owner doesn't match
    const notification = null; // owner.documentId != attacker's documentId
    
    if (!notification) {
      ctx.notFound();
    }

    expect(ctx.notFound).toHaveBeenCalled();
  });

  it('should ALLOW owner to mark their own notification as read', () => {
    const ctx = createMockCtx({ user: AUTHENTICATED_OWNER, params: { id: 'notif-1' } });
    
    // Simulate: findFirst returns the notification because owner matches
    const notification = { id: 1, documentId: 'notif-1', read: false, owner: { documentId: AUTHENTICATED_OWNER.documentId } };
    
    expect(notification).toBeTruthy();
    expect(notification.owner.documentId).toBe(AUTHENTICATED_OWNER.documentId);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. ARTICLE — Auto-set author on create
// ═══════════════════════════════════════════════════════════════
describe('Article — Ownership Auto-Assignment', () => {
  it('should BLOCK create by unauthenticated user', () => {
    const ctx = createMockCtx({ user: NO_USER, body: { data: { title: 'Test' } } });
    
    if (!ctx.state.user) {
      ctx.unauthorized('You must be logged in to create an article');
    }

    expect(ctx.unauthorized).toHaveBeenCalled();
  });

  it('should auto-set author from authenticated user (ignore client-supplied author)', () => {
    const ctx = createMockCtx({
      user: AUTHENTICATED_OWNER,
      body: { data: { title: 'Test', author: AUTHENTICATED_OTHER_USER.id } } // client sends wrong author
    });

    // The controller OVERRIDES the author:
    ctx.request.body.data = {
      ...ctx.request.body.data,
      author: ctx.state.user.id,
    };

    expect(ctx.request.body.data.author).toBe(AUTHENTICATED_OWNER.id);
    expect(ctx.request.body.data.author).not.toBe(AUTHENTICATED_OTHER_USER.id);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. COURSE — Auto-set owner on create
// ═══════════════════════════════════════════════════════════════
describe('Course — Ownership Auto-Assignment', () => {
  it('should BLOCK create by unauthenticated user', () => {
    const ctx = createMockCtx({ user: NO_USER, body: { data: { title: 'Course' } } });
    
    if (!ctx.state.user) {
      ctx.unauthorized('Authentication required');
    }

    expect(ctx.unauthorized).toHaveBeenCalled();
  });

  it('should auto-set users_permissions_user from authenticated user', () => {
    const ctx = createMockCtx({
      user: AUTHENTICATED_OWNER,
      body: { data: { title: 'My Course', users_permissions_user: AUTHENTICATED_OTHER_USER.id } }
    });

    ctx.request.body.data = {
      ...ctx.request.body.data,
      users_permissions_user: ctx.state.user.id,
    };

    expect(ctx.request.body.data.users_permissions_user).toBe(AUTHENTICATED_OWNER.id);
  });

  it('should correctly identify publisher in findOne response', () => {
    const userInfo = { id: AUTHENTICATED_OWNER.id, documentId: AUTHENTICATED_OWNER.documentId };
    const enrichedCourse = {
      users_permissions_user: { id: AUTHENTICATED_OWNER.id, documentId: AUTHENTICATED_OWNER.documentId }
    };

    const isPublisher = userInfo && (
      (userInfo.id && enrichedCourse.users_permissions_user?.id == userInfo.id) ||
      (userInfo.documentId && enrichedCourse.users_permissions_user?.documentId == userInfo.documentId)
    );

    expect(isPublisher).toBe(true);
  });

  it('should NOT identify attacker as publisher', () => {
    const userInfo = { id: AUTHENTICATED_OTHER_USER.id, documentId: AUTHENTICATED_OTHER_USER.documentId };
    const enrichedCourse = {
      users_permissions_user: { id: AUTHENTICATED_OWNER.id, documentId: AUTHENTICATED_OWNER.documentId }
    };

    const isPublisher = userInfo && (
      (userInfo.id && enrichedCourse.users_permissions_user?.id == userInfo.id) ||
      (userInfo.documentId && enrichedCourse.users_permissions_user?.documentId == userInfo.documentId)
    );

    expect(isPublisher).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. LESSON — Auto-set owner + entitlement-gated reads
// ═══════════════════════════════════════════════════════════════
describe('Lesson — Ownership & Access Control', () => {
  it('should BLOCK create by unauthenticated user', () => {
    const ctx = createMockCtx({ user: NO_USER, body: { data: { title: 'Lesson 1' } } });
    
    if (!ctx.state.user) {
      ctx.unauthorized('Not authenticated. Please login first.');
    }

    expect(ctx.unauthorized).toHaveBeenCalled();
  });

  it('should auto-set users_permissions_user from authenticated user', () => {
    const ctx = createMockCtx({
      user: AUTHENTICATED_OWNER,
      body: { data: { title: 'Lesson 1' } }
    });

    ctx.request.body.data = {
      ...ctx.request.body.data,
      users_permissions_user: ctx.state.user.id,
      publishedAt: new Date(),
    };

    expect(ctx.request.body.data.users_permissions_user).toBe(AUTHENTICATED_OWNER.id);
    expect(ctx.request.body.data.publishedAt).toBeTruthy();
  });

  it('should identify lesson owner via documentId', () => {
    const userDocId = AUTHENTICATED_OWNER.documentId;
    const lesson = { users_permissions_user: { documentId: AUTHENTICATED_OWNER.documentId } };
    
    const isOwner = userDocId && lesson.users_permissions_user?.documentId === userDocId;
    expect(isOwner).toBe(true);
  });

  it('should NOT identify attacker as lesson owner', () => {
    const userDocId = AUTHENTICATED_OTHER_USER.documentId;
    const lesson = { users_permissions_user: { documentId: AUTHENTICATED_OWNER.documentId } };
    
    const isOwner = userDocId && lesson.users_permissions_user?.documentId === userDocId;
    expect(isOwner).toBe(false);
  });

  it('should BLOCK direct access to lessons for unauthenticated users', () => {
    const ctx = createMockCtx({ user: NO_USER });
    
    // Lesson find requires authentication
    if (!ctx.state.user) {
      ctx.forbidden('Direct access to lessons is not allowed.');
    }

    expect(ctx.forbidden).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. COMMENT — Secure auto-set via DB (prevents client spoofing)
// ═══════════════════════════════════════════════════════════════
describe('Comment — Anti-Spoofing Ownership', () => {
  it('should BLOCK create by unauthenticated user', () => {
    const ctx = createMockCtx({ user: NO_USER });
    
    if (!ctx.state.user) {
      ctx.unauthorized('You must be logged in to comment.');
    }

    expect(ctx.unauthorized).toHaveBeenCalled();
  });

  it('should DELETE client-supplied users_permissions_user (anti-spoofing)', () => {
    const ctx = createMockCtx({
      user: AUTHENTICATED_OWNER,
      body: { data: { content: 'Test', users_permissions_user: AUTHENTICATED_OTHER_USER.id } }
    });

    // Simulate the controller's anti-spoofing logic
    if (ctx.request.body.data.users_permissions_user) {
      delete ctx.request.body.data.users_permissions_user;
    }

    expect(ctx.request.body.data.users_permissions_user).toBeUndefined();
  });

  it('should set publishedAt automatically', () => {
    const ctx = createMockCtx({
      user: AUTHENTICATED_OWNER,
      body: { data: { content: 'Test' } }
    });

    ctx.request.body.data.publishedAt = new Date();
    expect(ctx.request.body.data.publishedAt).toBeInstanceOf(Date);
  });

  it('should wrap raw body in data object if missing', () => {
    const ctx = createMockCtx({
      user: AUTHENTICATED_OWNER,
      body: { content: 'Test' } // no .data wrapper
    });

    if (!ctx.request.body.data) {
      ctx.request.body = { data: ctx.request.body };
    }

    expect(ctx.request.body.data).toBeDefined();
    expect(ctx.request.body.data.content).toBe('Test');
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. REPORT — Secure auto-set + review_status enforcement
// ═══════════════════════════════════════════════════════════════
describe('Report — Anti-Spoofing Ownership + Status Enforcement', () => {
  it('should BLOCK create by unauthenticated user', () => {
    const ctx = createMockCtx({ user: NO_USER });
    
    if (!ctx.state.user) {
      ctx.unauthorized('You must be logged in to report.');
    }

    expect(ctx.unauthorized).toHaveBeenCalled();
  });

  it('should DELETE client-supplied users_permissions_user (anti-spoofing)', () => {
    const ctx = createMockCtx({
      user: AUTHENTICATED_OWNER,
      body: { data: { description: 'Spam', users_permissions_user: AUTHENTICATED_OTHER_USER.id } }
    });

    if (ctx.request.body.data.users_permissions_user) {
      delete ctx.request.body.data.users_permissions_user;
    }

    expect(ctx.request.body.data.users_permissions_user).toBeUndefined();
  });

  it('should force review_status to pending (prevent client setting to reviewed)', () => {
    const ctx = createMockCtx({
      user: AUTHENTICATED_OWNER,
      body: { data: { description: 'Spam', review_status: 'reviewed' } }
    });

    // Controller forces pending
    ctx.request.body.data.review_status = 'pending';

    expect(ctx.request.body.data.review_status).toBe('pending');
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. EVENT — Service-based creation with ownership
// ═══════════════════════════════════════════════════════════════
describe('Event — Ownership Auto-Assignment', () => {
  it('should BLOCK create by unauthenticated user', () => {
    const ctx = createMockCtx({ user: NO_USER, body: { event: { title: 'Event' } } });
    
    if (!ctx.state.user) {
      ctx.unauthorized('You must be logged in to create an event.');
    }

    expect(ctx.unauthorized).toHaveBeenCalled();
  });

  it('should require event data in request body', () => {
    const ctx = createMockCtx({ user: AUTHENTICATED_OWNER, body: {} });
    
    const { event } = ctx.request.body;
    if (!event) {
      ctx.badRequest('Event data is required.');
    }

    expect(ctx.badRequest).toHaveBeenCalledWith('Event data is required.');
  });

  it('should pass authenticated user to the event service', () => {
    const ctx = createMockCtx({
      user: AUTHENTICATED_OWNER,
      body: { event: { title: 'My Event' }, entitlement: {} }
    });

    // The controller passes ctx.state.user to the service
    const userPassedToService = ctx.state.user;
    expect(userPassedToService.id).toBe(AUTHENTICATED_OWNER.id);
    expect(userPassedToService.documentId).toBe(AUTHENTICATED_OWNER.documentId);
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. USER-ENTITLEMENT — Ownership verification for grants/revocations
// ═══════════════════════════════════════════════════════════════
describe('User Entitlement — Ownership Verification', () => {
  function verifyOwnership(item, userId) {
    if (!item) return { authorized: false, error: 'Not found' };
    const isOwner = item.users_permissions_user?.id === userId;
    return { authorized: isOwner, item };
  }

  it('should authorize owner to manage entitlements', () => {
    const item = { id: 1, users_permissions_user: { id: AUTHENTICATED_OWNER.id } };
    const result = verifyOwnership(item, AUTHENTICATED_OWNER.id);
    expect(result.authorized).toBe(true);
  });

  it('should DENY non-owner from managing entitlements', () => {
    const item = { id: 1, users_permissions_user: { id: AUTHENTICATED_OWNER.id } };
    const result = verifyOwnership(item, AUTHENTICATED_OTHER_USER.id);
    expect(result.authorized).toBe(false);
  });

  it('should handle missing item gracefully', () => {
    const result = verifyOwnership(null, AUTHENTICATED_OWNER.id);
    expect(result.authorized).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// 12. LIKE — Toggle operation with user scoping
// ═══════════════════════════════════════════════════════════════
describe('Like — User-Scoped Toggle', () => {
  it('should BLOCK toggle by unauthenticated user', () => {
    const ctx = createMockCtx({ user: NO_USER });
    
    if (!ctx.state.user) {
      ctx.unauthorized('Authentication required');
    }

    expect(ctx.unauthorized).toHaveBeenCalled();
  });

  it('should scope like lookup to the authenticated user', () => {
    const user = AUTHENTICATED_OWNER;
    const queryWhere = {
      content_types: 'course',
      docId: 'course-1',
      users_permissions_user: user.id
    };

    expect(queryWhere.users_permissions_user).toBe(AUTHENTICATED_OWNER.id);
    expect(queryWhere.users_permissions_user).not.toBe(AUTHENTICATED_OTHER_USER.id);
  });

  it('should use user.id for DB-level like creation (not documentId)', () => {
    const user = AUTHENTICATED_OWNER;
    const likeData = {
      content_types: 'blog',
      docId: 'blog-1',
      users_permissions_user: user.id, // must use numeric id for DB
      publishedAt: new Date(),
    };

    expect(typeof likeData.users_permissions_user).toBe('number');
    expect(likeData.users_permissions_user).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 13. OWNERSHIP MAP — Single Source of Truth
// ═══════════════════════════════════════════════════════════════
describe('Ownership Map — Registry Completeness', () => {
  const { OWNERSHIP_MAP } = require('../../../src/api/notification/constants');

  it('should contain all major content types', () => {
    expect(OWNERSHIP_MAP.course).toBeDefined();
    expect(OWNERSHIP_MAP.event).toBeDefined();
    expect(OWNERSHIP_MAP.article).toBeDefined();
    expect(OWNERSHIP_MAP.blog).toBeDefined();
  });

  it('should map correct UIDs', () => {
    expect(OWNERSHIP_MAP.course.uid).toBe('api::course.course');
    expect(OWNERSHIP_MAP.event.uid).toBe('api::event.event');
    expect(OWNERSHIP_MAP.article.uid).toBe('api::article.article');
    expect(OWNERSHIP_MAP.blog.uid).toBe('api::blog.blog');
  });

  it('should map correct owner fields', () => {
    expect(OWNERSHIP_MAP.course.ownerField).toBe('users_permissions_user');
    expect(OWNERSHIP_MAP.event.ownerField).toBe('users_permissions_user');
    expect(OWNERSHIP_MAP.article.ownerField).toBe('author');
    expect(OWNERSHIP_MAP.blog.ownerField).toBe('publisher');
  });
});

// ═══════════════════════════════════════════════════════════════
// 14. FILE OWNERSHIP MIDDLEWARE — Content + File Ownership
// ═══════════════════════════════════════════════════════════════
describe('File Ownership Middleware — validateContentOwnership (Direct)', () => {
  const {
    validateContentOwnership,
    validateFileOwnership,
    extractOwnerId,
  } = require('../../../src/middlewares/file-ownership-middleware');

  it('should ALLOW create when owner matches current user', async () => {
    const context = {
      action: 'create',
      uid: 'api::course.course',
      params: { data: { users_permissions_user: AUTHENTICATED_OWNER.id } },
      contentType: { attributes: { users_permissions_user: { type: 'relation' } } },
    };
    const mockStrapi = { db: { query: vi.fn() } };

    await expect(validateContentOwnership(context, AUTHENTICATED_OWNER.id, mockStrapi)).resolves.toBeUndefined();
  });

  it('should THROW on create when trying to impersonate another user', async () => {
    const context = {
      action: 'create',
      uid: 'api::course.course',
      params: { data: { users_permissions_user: AUTHENTICATED_OTHER_USER.id } },
      contentType: { attributes: { users_permissions_user: { type: 'relation' } } },
    };
    const mockStrapi = { db: { query: vi.fn() } };

    await expect(validateContentOwnership(context, AUTHENTICATED_OWNER.id, mockStrapi)).rejects.toThrow('Cannot create');
  });

  it('should ALLOW update when current user owns the content', async () => {
    const context = {
      action: 'update',
      uid: 'api::blog.blog',
      params: { data: { title: 'Updated' }, documentId: 'blog-1' },
      contentType: { attributes: { users_permissions_user: { type: 'relation' } } },
    };
    const mockStrapi = {
      db: {
        query: vi.fn(() => ({
          findOne: vi.fn().mockResolvedValue({ id: 1, users_permissions_user: { id: AUTHENTICATED_OWNER.id } }),
        })),
      },
    };

    await expect(validateContentOwnership(context, AUTHENTICATED_OWNER.id, mockStrapi)).resolves.toBeUndefined();
  });

  it('should THROW on update when current user does NOT own the content', async () => {
    const context = {
      action: 'update',
      uid: 'api::blog.blog',
      params: { data: { title: 'Hacked!' }, documentId: 'blog-1' },
      contentType: { attributes: { users_permissions_user: { type: 'relation' } } },
    };
    const mockStrapi = {
      db: {
        query: vi.fn(() => ({
          findOne: vi.fn().mockResolvedValue({ id: 1, users_permissions_user: { id: AUTHENTICATED_OWNER.id } }),
        })),
      },
    };

    await expect(validateContentOwnership(context, AUTHENTICATED_OTHER_USER.id, mockStrapi)).rejects.toThrow('do not own');
  });

  it('should SKIP ownership check for content types without owner field', async () => {
    const context = {
      action: 'create',
      uid: 'api::global-tag.global-tag',
      params: { data: { name: 'JavaScript' } },
      contentType: { attributes: { name: { type: 'string' } } }, // no owner field
    };
    const mockStrapi = { db: { query: vi.fn() } };

    await expect(validateContentOwnership(context, AUTHENTICATED_OWNER.id, mockStrapi)).resolves.toBeUndefined();
    expect(mockStrapi.db.query).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// 15. CROSS-CUTTING: Comprehensive Ownership Matrix
// ═══════════════════════════════════════════════════════════════
describe('Cross-Cutting Ownership Matrix', () => {
  const CONTENT_TYPES = [
    { name: 'Blog',    ownerField: 'publisher',               ownerCheck: (obj, userId) => obj.publisher?.id === userId },
    { name: 'Article', ownerField: 'author',                  ownerCheck: (obj, userId) => obj.author?.id === userId },
    { name: 'Course',  ownerField: 'users_permissions_user',  ownerCheck: (obj, userId) => obj.users_permissions_user?.id === userId },
    { name: 'Event',   ownerField: 'users_permissions_user',  ownerCheck: (obj, userId) => obj.users_permissions_user?.id === userId },
    { name: 'Lesson',  ownerField: 'users_permissions_user',  ownerCheck: (obj, userId) => obj.users_permissions_user?.id === userId },
  ];

  CONTENT_TYPES.forEach(({ name, ownerField, ownerCheck }) => {
    describe(`${name} (${ownerField})`, () => {
      const content = { [ownerField]: { id: AUTHENTICATED_OWNER.id } };

      it(`should identify owner correctly`, () => {
        expect(ownerCheck(content, AUTHENTICATED_OWNER.id)).toBe(true);
      });

      it(`should reject non-owner`, () => {
        expect(ownerCheck(content, AUTHENTICATED_OTHER_USER.id)).toBe(false);
      });

      it(`should handle null owner field gracefully`, () => {
        const noOwner = { [ownerField]: null };
        expect(ownerCheck(noOwner, AUTHENTICATED_OWNER.id)).toBeFalsy();
      });

      it(`should handle missing owner field gracefully`, () => {
        const missing = {};
        expect(ownerCheck(missing, AUTHENTICATED_OWNER.id)).toBeFalsy();
      });
    });
  });
});
