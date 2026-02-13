'use strict';

/**
 * Strapi Mock Helper
 * Simulates a minimal Strapi global object for unit testing.
 */

class StrapiMock {
  constructor() {
    this.services = new Map();
    this.plugins = {
      'users-permissions': {
        services: {
          jwt: {
            verify: (token) => ({ id: 1 }),
            issue: (payload) => 'mock-token'
          }
        }
      }
    };
    
    this.db = {
      query: (uid) => ({
        findOne: async () => ({ id: 1, username: 'tester', role: { type: 'authenticated' } }),
        findMany: async () => [],
        update: async () => ({ id: 1 }),
        create: async () => ({ id: 1 }),
        delete: async () => ({ id: 1 }),
      })
    };

    this.log = {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {}
    };

    // Placeholder for socket.io
    this.io = {
      emit: () => {},
      to: () => ({ emit: () => {} })
    };
  }

  registerService(uid, implementation) {
    this.services.set(uid, implementation);
  }

  contentType(uid) {
    return {
      attributes: {},
      uid
    };
  }

  service(uid) {
    if (!this.services.has(uid)) {
      return {
        run: async () => ({}),
        initialize: () => ({}),
        handleWebhook: async () => ({}),
        register: async () => ({}),
        getFullDetails: async () => ({}),
        getMetricsAndAccess: async () => ({}),
        notifyStatusChange: () => {},
        handleFailure: async () => ({}),
        notifyComplete: () => {}
      };
    }
    return this.services.get(uid);
  }

  documents(uid) {
    return {
      findOne: async (p) => ({ id: 1, documentId: p.documentId || 'doc-1', title: 'Mock' }),
      findMany: async () => [{ id: 1, documentId: 'doc-1' }],
      findFirst: async () => ({ id: 1 }),
      create: async (p) => ({ id: 1, ...p.data }),
      update: async (p) => ({ id: 1, ...p.data }),
      delete: async () => ({ id: 1 }),
    };
  }

  mockContext(options = {}) {
    return {
      request: {
        body: options.body || {},
        method: options.method || 'GET',
        path: options.path || '/'
      },
      ip: options.ip || '127.0.0.1',
      state: {},
      cookies: {
        get: (name) => options.cookies?.[name] || null,
        set: () => {}
      },
      badRequest: (msg) => new Error(msg),
      tooManyRequests: (msg) => new Error(msg),
      forbidden: (msg) => new Error(msg),
      ...options
    };
  }
}

module.exports = StrapiMock; // Export Class for isolation
