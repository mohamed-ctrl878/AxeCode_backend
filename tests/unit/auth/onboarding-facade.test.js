import { describe, it, expect, vi, beforeEach } from 'vitest';
const StrapiMock = require('../../helpers/strapi-mock');
const strapiMock = new StrapiMock();

const facadeFactory = require('../../../src/api/auth/services/onboarding-facade');
const facade = facadeFactory({ strapi: strapiMock });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('OnboardingFacade Service', () => {
  describe('fullRegistration', () => {
    it('should skip community join if user has no university', async () => {
        const mockUser = { id: 1, username: 'tester', university: null };
        vi.spyOn(strapiMock, 'service').mockReturnValue({
          register: async () => ({ jwt: 'abc', user: mockUser })
        });
        const joinSpy = vi.spyOn(facade, 'joinUniversityCommunity');
  
        await facade.fullRegistration({}, { username: 'tester' });
        expect(joinSpy).not.toHaveBeenCalled();
    });
  });

  describe('joinUniversityCommunity', () => {
    it('should connect user to conversation if university room exists', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ id: 50 });
      const queryMock = {
        findOne: vi.fn().mockResolvedValue({ id: 50, title: 'MIT' }),
        update: mockUpdate
      };
      
      vi.spyOn(strapiMock.db, 'query').mockReturnValue(queryMock);

      await facade.joinUniversityCommunity({ id: 1, username: 'tester', university: 'MIT' });
      
      expect(queryMock.findOne).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 50 },
        data: { members: { connect: [1] } }
      }));
    });

    it('should do nothing if university room does not exist', async () => {
        const mockUpdate = vi.fn();
        vi.spyOn(strapiMock.db, 'query').mockReturnValue({
          findOne: async () => null,
          update: mockUpdate
        });
  
        await facade.joinUniversityCommunity({ id: 1, username: 'tester', university: 'None' });
        expect(mockUpdate).not.toHaveBeenCalled();
      });

    it('should catch and log errors during community join', async () => {
        vi.spyOn(strapiMock.db, 'query').mockImplementation(() => {
            throw new Error('Database down');
        });
        const logSpy = vi.spyOn(strapiMock.log, 'error');
        
        await facade.joinUniversityCommunity({ id: 1, university: 'MIT' });
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Social integration error'));
    });
  });
});
