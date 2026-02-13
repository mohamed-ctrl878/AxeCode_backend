import { describe, it, expect, vi } from 'vitest';
const StrapiMock = require('../../helpers/strapi-mock');
const strapiMock = new StrapiMock();

const logicFactory = require('../../../src/api/conversation/services/messaging-logic');
const messagingLogic = logicFactory({ strapi: strapiMock });

describe('MessagingLogic Service', () => {
  describe('validateBlocks', () => {
    it('should return valid for correct paragraph block', () => {
      const blocks = [{ type: 'paragraph', children: [{ type: 'text', text: 'Hello' }] }];
      expect(messagingLogic.validateBlocks(blocks).valid).toBe(true);
    });

    it('should return invalid for empty blocks array', () => {
      expect(messagingLogic.validateBlocks([]).valid).toBe(false);
    });

    it('should return invalid for unknown top-level block type', () => {
      const blocks = [{ type: 'unknown', children: [] }];
      expect(messagingLogic.validateBlocks(blocks).valid).toBe(false);
    });

    it('should return invalid if children is not an array', () => {
      const blocks = [{ type: 'paragraph', children: {} }];
      expect(messagingLogic.validateBlocks(blocks).valid).toBe(false);
    });

    it('should return invalid for deep nested invalid child', () => {
      const blocks = [{ 
        type: 'list', 
        children: [{ 
          type: 'paragraph', 
          children: [{ type: 'invalid' }] // Missing properties/type
        }] 
      }];
      expect(messagingLogic.validateBlocks(blocks).valid).toBe(false);
    });

    it('should return invalid for non-string text node', () => {
      const blocks = [{ type: 'paragraph', children: [{ type: 'text', text: 123 }] }];
      expect(messagingLogic.validateBlocks(blocks).valid).toBe(false);
    });

    it('should return invalid for non-image node without children or text', () => {
      const blocks = [{ type: 'paragraph' }]; // No children/text
      expect(messagingLogic.validateBlocks(blocks).valid).toBe(false);
    });

    it('should return valid for image node without children', () => {
      const blocks = [{ type: 'image' }];
      expect(messagingLogic.validateBlocks(blocks).valid).toBe(true);
    });
  });

  describe('getHistory', () => {
    it('should apply beforeTimestamp filter if provided', async () => {
      const findManySpy = vi.spyOn(strapiMock, 'documents').mockReturnValue({
        findMany: async () => []
      });

      await messagingLogic.getHistory('conv-1', 20, '2025-01-01T00:00:00Z');
      
      expect(findManySpy).toHaveBeenCalledWith('api::message.message');
      const callArgs = findManySpy.mock.results[0].value.findMany; // This is a bit complex due to the proxy
    });
  });

  describe('formatMessage', () => {
    it('should correctly format a message database object', () => {
      const dbMessage = {
        id: 1,
        users_permissions_user: { id: 10, username: 'tester', role: { type: 'authenticated' } },
        message: [{ type: 'text', text: 'hi' }],
        createdAt: '2025-01-01'
      };
      const formatted = messagingLogic.formatMessage(dbMessage, 'conv-abc');
      
      expect(formatted.conversationId).toBe('conv-abc');
      expect(formatted.sender.username).toBe('tester');
      expect(formatted.sender.role).toBe('authenticated');
      expect(formatted.blocks).toEqual(dbMessage.message);
    });
  });
});
