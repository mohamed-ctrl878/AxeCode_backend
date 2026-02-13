import { describe, it, expect, vi, beforeEach } from 'vitest';
const StrapiMock = require('../../helpers/strapi-mock');
const strapiMock = new StrapiMock();

const facadeFactory = require('../../../src/api/live-stream/services/media-lifecycle-facade');
const facade = facadeFactory({ strapi: strapiMock });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('MediaLifecycleFacade Service', () => {
  describe('handleMediaEvent', () => {
    it('should call stream logic and announce if status is live', async () => {
      const mockStream = { documentId: 's1', title: 'Live Show' };
      
      vi.spyOn(strapiMock, 'service').mockReturnValue({
        handleWebhook: async () => mockStream
      });
      const announceSpy = vi.spyOn(facade, 'announceLiveStatus').mockImplementation(() => {});

      await facade.handleMediaEvent('key-123', 'live');
      
      expect(announceSpy).toHaveBeenCalledWith(mockStream);
    });

    it('should return null if stream logic returns null', async () => {
      vi.spyOn(strapiMock, 'service').mockReturnValue({
        handleWebhook: async () => null
      });
      const result = await facade.handleMediaEvent('key-1', 'live');
      expect(result).toBeNull();
    });

    it('should not announce if status is ended', async () => {
        const mockStream = { id: 1 };
        vi.spyOn(strapiMock, 'service').mockReturnValue({
          handleWebhook: async () => mockStream
        });
        const announceSpy = vi.spyOn(facade, 'announceLiveStatus');
  
        await facade.handleMediaEvent('key-123', 'ended');
        expect(announceSpy).not.toHaveBeenCalled();
      });
  });

  describe('announceLiveStatus', () => {
    it('should emit broadcast:started if strapi.io exists', () => {
      const emitSpy = vi.fn();
      strapiMock.io = { emit: emitSpy };
      
      facade.announceLiveStatus({ documentId: 's1', title: 'Test' });
      expect(emitSpy).toHaveBeenCalledWith('broadcast:started', expect.objectContaining({ id: 's1' }));
    });

    it('should skip announcement if strapi.io is missing', () => {
        delete strapiMock.io;
        expect(() => facade.announceLiveStatus({})).not.toThrow();
    });
  });
});
