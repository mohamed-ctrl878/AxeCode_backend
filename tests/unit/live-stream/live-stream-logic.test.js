import { describe, it, expect, vi, beforeEach } from 'vitest';
const StrapiMock = require('../../helpers/strapi-mock');
const strapiMock = new StrapiMock();

const logicFactory = require('../../../src/api/live-stream/services/live-stream-logic');
const liveStreamLogic = logicFactory({ strapi: strapiMock });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('LiveStreamLogic Service', () => {
  describe('generateStreamMetadata', () => {
    it('should generate a 32-character hex stream key and correct playback URL', () => {
      process.env.MEDIAMTX_HLS_URL = 'http://test-server:8888';
      const metadata = liveStreamLogic.generateStreamMetadata();
      
      expect(metadata.streamKey).toHaveLength(32);
      expect(metadata.playbackUrl).toContain('http://test-server:8888');
      expect(metadata.playbackUrl).toContain(metadata.streamKey);
    });
  });

  describe('updateStreamLifecycle', () => {
    it('should update status and set startedAt when live', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ id: 1 });
      vi.spyOn(strapiMock, 'documents').mockReturnValue({ update: mockUpdate });
      vi.spyOn(liveStreamLogic, 'notifyStatusChange').mockImplementation(() => {});

      await liveStreamLogic.updateStreamLifecycle('doc-1', 'live');
      
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        documentId: 'doc-1',
        data: expect.objectContaining({ status: 'live', startedAt: expect.any(Date) })
      }));
    });

    it('should set endedAt when ended', async () => {
        const mockUpdate = vi.fn().mockResolvedValue({ id: 1 });
        vi.spyOn(strapiMock, 'documents').mockReturnValue({ update: mockUpdate });
        vi.spyOn(liveStreamLogic, 'notifyStatusChange').mockImplementation(() => {});
  
        await liveStreamLogic.updateStreamLifecycle('doc-1', 'ended');
        
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.objectContaining({ status: 'ended', endedAt: expect.any(Date) })
        }));
    });
  });

  describe('handleWebhook', () => {
    it('should find total stream by key and update its lifecycle', async () => {
        vi.spyOn(strapiMock, 'documents').mockReturnValue({
            findMany: async () => [{ documentId: 'found-doc' }]
        });
        const spy = vi.spyOn(liveStreamLogic, 'updateStreamLifecycle').mockResolvedValue({ id: 1 });

        await liveStreamLogic.handleWebhook('key-1', 'live');
        expect(spy).toHaveBeenCalledWith('found-doc', 'live');
    });

    it('should return null if stream key is not found', async () => {
        vi.spyOn(strapiMock, 'documents').mockReturnValue({
            findMany: async () => []
        });
        const result = await liveStreamLogic.handleWebhook('unknown', 'live');
        expect(result).toBeNull();
    });
  });
});
