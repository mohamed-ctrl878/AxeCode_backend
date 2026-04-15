'use strict';

/**
 * Strapi Mock Helper (Refined for Spyability & Performance)
 * Simulates a minimal Strapi global object for unit testing.
 * Uses a stable recursive Proxy to provide deep auto-mocking.
 * Fixes issue where new vitest functions were created on every access, breaking spies.
 */

class StrapiMock {
  constructor() {
    this.services = new Map();
    this.queryInstances = new Map();
    this.documentInstances = new Map();
    this.cache = new Map(); // Cache deep mocks by path
    
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
      query: (uid) => {
        if (!this.queryInstances.has(uid)) {
          this.queryInstances.set(uid, this.createDeepMock(`db.query:${uid}`, {
            findOne: async () => ({ id: 1, username: 'tester', role: { id: 1, type: 'authenticated' } }),
            findMany: async () => [],
            count: async () => 0,
            update: async () => ({ id: 1 }),
            create: async () => ({ id: 1 }),
            delete: async () => ({ id: 1 }),
          }));
        }
        return this.queryInstances.get(uid);
      }
    };
    
    this.query = this.db.query;

    this.log = {
      info: () => { },
      error: () => { },
      warn: () => { },
      debug: () => { }
    };

    this.io = {
      emit: () => { },
      to: () => ({ emit: () => { } })
    };

    const rootProxy = new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) return target[prop];
        
        // Handle core controller helpers
        if (prop === 'getCoreController' || prop === 'controller') {
          return (uid) => this.createDeepMock(`controller:${uid}`, {
             findOne: async () => ({ data: { id: 1 } }),
             findMany: async () => ({ data: [] }),
             find: async () => ({ data: [] }),
          });
        }

        return this.createDeepMock(`strapi.${String(prop)}`);
      }
    });

    global.strapi = rootProxy;
    return rootProxy;
  }

  createDeepMock(path, initialProperties = {}) {
    if (this.cache.has(path)) return this.cache.get(path);

    const vitest = (typeof vi !== 'undefined') ? { vi } : (function() { try { return require('vitest'); } catch(e) { return null; } })();
    const localVi = vitest?.vi || vitest;

    // The target is the MOCK FUNCTION ITSELF. This allows spies to be attached properly.
    const mockFn = localVi?.fn ? localVi.fn(async (d) => d) : async (d) => d;
    
    // Copy initial properties
    Object.assign(mockFn, initialProperties);

    const proxy = new Proxy(mockFn, {
      get: (t, prop) => {
        if (prop in t) return t[prop];
        
        // Protections for Vitest/Node inspection
        if (prop === 'then' || prop === 'constructor' || prop === 'length' || 
            prop === 'toJSON' || prop === 'inspect' || 
            typeof prop === 'symbol' || String(prop).startsWith('symbol')) {
          return undefined;
        }

        // Recursively create and CACHE the mock for this sub-property
        t[prop] = this.createDeepMock(`${path}.${String(prop)}`);
        return t[prop];
      },
      // Since mockFn itself is a function, applying the proxy calls mockFn.
      // Spies on mockFn will catch these calls.
    });

    this.cache.set(path, proxy);
    return proxy;
  }

  registerService(uid, implementation) {
    this.services.set(uid, implementation);
    // Also invalidate cache for this service path if it existed as a generic mock
    this.cache.delete(`service:${uid}`);
    this.cache.delete(`strapi.service:${uid}`);
  }

  contentType(uid) {
    return {
      attributes: {},
      uid
    };
  }

  service(uid) {
    if (!this.services.has(uid)) {
      this.services.set(uid, this.createDeepMock(`service:${uid}`, {
        run: async () => ({}),
        initialize: () => ({}),
        handleWebhook: async () => ({}),
        register: async () => ({}),
        getFullDetails: async () => ({}),
        getMetricsAndAccess: async () => ({}),
        notifyStatusChange: () => { },
        handleFailure: async () => ({}),
        notifyComplete: () => { },
        verifyToken: (token) => ({ id: 1 }),
        setAuthCookie: () => { },
        enrichLesson: (l) => l,
        enrichCourse: (c) => c,
        find: async () => ({ data: [] }),
        findOne: async () => ({ data: { id: 1 } }),
      }));
    }
    return this.services.get(uid);
  }

  documents(uid) {
    if (!this.documentInstances.has(uid)) {
      this.documentInstances.set(uid, this.createDeepMock(`documents:${uid}`, {
        findOne: async (p) => ({ id: 1, documentId: p?.documentId || 'doc-1', title: 'Mock' }),
        findMany: async () => [{ id: 1, documentId: 'doc-1' }],
        findFirst: async () => ({ id: 1 }),
        count: async () => 0,
        create: async (p) => ({ id: 1, ...p?.data }),
        update: async (p) => ({ id: 1, ...p?.data }),
        delete: async () => ({ id: 1 }),
      }));
    }
    return this.documentInstances.get(uid);
  }

  mockContext(options = {}) {
    const vitest = (typeof vi !== 'undefined') ? { vi } : (function() { try { return require('vitest'); } catch(e) { return null; } })();
    const localVi = vitest?.vi || vitest;

    const responses = options._responses || {};

    return {
      request: {
        body: options.body || {},
        method: options.method || 'GET',
        path: options.path || '/',
        header: options.header || {}
      },
      query: options.query || {},
      ip: options.ip || '127.0.0.1',
      state: { user: options.user || null },
      cookies: {
        get: (name) => options.cookies?.[name] || null,
        set: localVi?.fn ? localVi.fn() : () => {}
      },
      response: {
        get: localVi?.fn ? localVi.fn().mockReturnValue(options.headers?.['Set-Cookie'] || []) : () => options.headers?.['Set-Cookie'] || [],
      },
      set: localVi?.fn ? localVi.fn().mockImplementation((k, v) => { responses[k] = v; }) : (k, v) => { responses[k] = v; },
      send: localVi?.fn ? localVi.fn().mockImplementation((val) => {
        responses.body = val;
        return val;
      }) : (val) => { 
        responses.body = val;
        return val; 
      },
      badRequest: (msg) => { options.status = 400; responses.status = 400; return new Error(msg); },
      tooManyRequests: (msg) => { options.status = 429; responses.status = 429; return new Error(msg); },
      forbidden: (msg) => { options.status = 403; responses.status = 403; return new Error(msg); },
      unauthorized: (msg) => { options.status = 401; responses.status = 401; return new Error(msg); },
      notFound: (msg) => { options.status = 404; responses.status = 404; return new Error(msg); },
      _responses: responses,
      ...options
    };
  }
}

module.exports = StrapiMock;
