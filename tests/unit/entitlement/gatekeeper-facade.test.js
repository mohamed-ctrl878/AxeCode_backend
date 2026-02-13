import { describe, it, expect, vi } from 'vitest';
const StrapiMock = require('../../helpers/strapi-mock');
const strapiMock = new StrapiMock();

const gatekeeperFactory = require('../../../src/api/entitlement/services/gatekeeper-facade');
const gatekeeper = gatekeeperFactory({ strapi: strapiMock });

describe('GatekeeperFacade Service', () => {
  describe('validateEventAccess', () => {
    it('should fail if ticket does not exist', async () => {
      vi.spyOn(strapiMock, 'documents').mockReturnValue({
        findOne: async () => null
      });

      const result = await gatekeeper.validateEventAccess('wrong-id', 1);
      expect(result.success).toBe(false);
      expect(result.code).toBe('TICKET_NOT_FOUND');
    });

    it('should fail if ticket is already expired', async () => {
      vi.spyOn(strapiMock, 'documents').mockReturnValue({
        findOne: async () => ({ valid: 'expired' })
      });

      const result = await gatekeeper.validateEventAccess('exp-id', 1);
      expect(result.success).toBe(false);
      expect(result.code).toBe('TICKET_EXPIRED');
    });

    it('should fail if product is not an event ticket', async () => {
        vi.spyOn(strapiMock, 'documents').mockReturnValue({
            findOne: async () => ({ valid: 'valid', productId: 'p-1' }),
            findMany: async () => [{ documentId: 'p-1', content_types: 'course' }] // Not upevent
        });

        const result = await gatekeeper.validateEventAccess('ticket-1', 1);
        expect(result.success).toBe(false);
        expect(result.code).toBe('INVALID_PRODUCT');
    });

    it('should fail if event does not exist', async () => {
        vi.spyOn(strapiMock, 'documents').mockReturnValue({
            findOne: async (params) => {
                if (params.documentId === 'ticket-1') return { valid: 'valid', productId: 'p-1' };
                return null; // Event not found
            },
            findMany: async () => [{ documentId: 'p-1', itemId: 'e-1', content_types: 'upevent' }]
        });

        const result = await gatekeeper.validateEventAccess('ticket-1', 1);
        expect(result.success).toBe(false);
        expect(result.code).toBe('EVENT_NOT_FOUND');
    });

    it('should fail if scanner is not authorized for the event', async () => {
        vi.spyOn(strapiMock, 'documents').mockReturnValue({
            findOne: async (params) => {
                if (params.documentId === 'ticket-1') return { valid: 'valid', productId: 'p-1' };
                if (params.documentId === 'e-1') return { title: 'Event', scanners: [{ users_permissions_user: { id: 99 } }] };
                return null;
            },
            findMany: async () => [{ documentId: 'p-1', itemId: 'e-1', content_types: 'upevent' }]
        });

        const result = await gatekeeper.validateEventAccess('ticket-1', 1); // Scanner is 1, authorized is 99
        expect(result.success).toBe(false);
        expect(result.code).toBe('UNAUTHORIZED_SCANNER');
    });

    it('should succeed and consume ticket if all valid', async () => {
        const mockUpdate = vi.fn();
        vi.spyOn(strapiMock, 'documents').mockReturnValue({
            findOne: async (params) => {
                if (params.documentId === 'ticket-1') return { valid: 'valid', productId: 'p-1', users_permissions_user: { username: 'bob' } };
                if (params.documentId === 'e-1') return { title: 'Event', scanners: [{ users_permissions_user: { id: 1 } }] };
                return null;
            },
            findMany: async () => [{ documentId: 'p-1', itemId: 'e-1', content_types: 'upevent' }],
            update: mockUpdate
        });

        const result = await gatekeeper.validateEventAccess('ticket-1', 1);
        expect(result.success).toBe(true);
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
            data: { valid: 'expired' }
        }));
    });
  });
});
