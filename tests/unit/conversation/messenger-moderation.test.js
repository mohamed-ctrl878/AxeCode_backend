import { describe, it, expect, vi } from 'vitest';
const StrapiMock = require('../../helpers/strapi-mock');
const strapiMock = new StrapiMock();

const moderationFactory = require('../../../src/api/conversation/services/messenger-moderation');
const moderation = moderationFactory({ strapi: strapiMock });

describe('MessengerModeration Service', () => {
  describe('getPermissions', () => {
    it('should return exists: false if conversation is not found', async () => {
      vi.spyOn(strapiMock, 'documents').mockReturnValue({
        findFirst: async () => null
      });

      const perms = await moderation.getPermissions('c-none', 'u-123');
      expect(perms.exists).toBe(false);
    });
  });

  describe('toggleMute', () => {
    it('should add user to muted_users if not already muted', async () => {
      const mockUpdate = vi.fn();
      vi.spyOn(strapiMock, 'documents').mockReturnValue({
        findOne: async () => ({ muted_users: [{ documentId: 'u-other' }] }),
        update: mockUpdate
      });

      const result = await moderation.toggleMute('c-1', 'u-123');
      expect(result).toBe(true); // Should be muted now
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: { muted_users: ['u-other', 'u-123'] }
      }));
    });

    it('should remove user from muted_users if already muted', async () => {
      const mockUpdate = vi.fn();
      vi.spyOn(strapiMock, 'documents').mockReturnValue({
        findOne: async () => ({ muted_users: [{ documentId: 'u-123' }] }),
        update: mockUpdate
      });

      const result = await moderation.toggleMute('c-1', 'u-123');
      expect(result).toBe(false); // Should be unmuted now
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: { muted_users: [] }
      }));
    });

    it('should throw error if conversation is missing', async () => {
      vi.spyOn(strapiMock, 'documents').mockReturnValue({
        findOne: async () => null
      });

      await expect(moderation.toggleMute('c-none', 'u-123')).rejects.toThrow('Conversation not found');
    });
  });

  describe('manageRoles', () => {
    it('should add a member if they do not exist', async () => {
      const mockUpdate = vi.fn();
      vi.spyOn(strapiMock, 'documents').mockReturnValue({
        findOne: async () => ({ members: [], admins: [] }),
        update: mockUpdate
      });

      await moderation.manageRoles('c-1', 'u-new', 'add_member');
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: { members: ['u-new'], admins: [] }
      }));
    });

    it('should remove a member from both lists', async () => {
      const mockUpdate = vi.fn();
      vi.spyOn(strapiMock, 'documents').mockReturnValue({
        findOne: async () => ({ 
          members: [{ documentId: 'u-123' }], 
          admins: [{ documentId: 'u-123' }] 
        }),
        update: mockUpdate
      });

      await moderation.manageRoles('c-1', 'u-123', 'remove_member');
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: { members: [], admins: [] }
      }));
    });

    it('should promote a member to admin', async () => {
      const mockUpdate = vi.fn();
      vi.spyOn(strapiMock, 'documents').mockReturnValue({
        findOne: async () => ({ 
          members: [{ documentId: 'u-123' }], 
          admins: [] 
        }),
        update: mockUpdate
      });

      await moderation.manageRoles('c-1', 'u-123', 'add_admin');
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: { members: [], admins: ['u-123'] }
      }));
    });

    it('should demote an admin to member', async () => {
      const mockUpdate = vi.fn();
      vi.spyOn(strapiMock, 'documents').mockReturnValue({
        findOne: async () => ({ 
          members: [], 
          admins: [{ documentId: 'u-123' }] 
        }),
        update: mockUpdate
      });

      await moderation.manageRoles('c-1', 'u-123', 'remove_admin');
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: { members: ['u-123'], admins: [] }
      }));
    });
  });
});
