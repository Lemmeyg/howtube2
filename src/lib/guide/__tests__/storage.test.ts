import { SupabaseClient } from '@supabase/supabase-js'
import { GuideStorage } from '../storage'
import { Guide } from '../openai'
import { logger } from '@/config/logger'

// Mock dependencies
jest.mock('@/config/logger')

describe('GuideStorage', () => {
  const mockVideoId = 'test-video-id'
  const mockUserId = 'test-user-id'
  const mockGuideId = 'test-guide-id'

  const mockGuide: Guide = {
    title: 'Test Guide',
    summary: 'A test guide',
    sections: [
      {
        title: 'Section 1',
        content: 'Content 1',
        timestamp: {
          start: 0,
          end: 1000,
        },
      },
      {
        title: 'Section 2',
        content: 'Content 2',
      },
    ],
    keywords: ['test', 'guide'],
    difficulty: 'intermediate',
  }

  const mockSupabase = {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: { id: mockGuideId },
            error: null,
          })),
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            data: {
              id: mockGuideId,
              video_id: mockVideoId,
              title: mockGuide.title,
              summary: mockGuide.summary,
              keywords: mockGuide.keywords,
              difficulty: mockGuide.difficulty,
              status: 'completed',
              user_id: mockUserId,
              created_at: '2024-03-23T00:00:00Z',
              updated_at: '2024-03-23T00:00:00Z',
            },
            error: null,
          })),
          order: jest.fn(() => ({
            data: [
              {
                title: 'Section 1',
                content: 'Content 1',
                timestamp: {
                  start: 0,
                  end: 1000,
                },
              },
              {
                title: 'Section 2',
                content: 'Content 2',
              },
            ],
            error: null,
          })),
        })),
        order: jest.fn(() => ({
          data: [
            {
              id: mockGuideId,
              video_id: mockVideoId,
              title: mockGuide.title,
              summary: mockGuide.summary,
              keywords: mockGuide.keywords,
              difficulty: mockGuide.difficulty,
              status: 'completed',
              user_id: mockUserId,
              created_at: '2024-03-23T00:00:00Z',
              updated_at: '2024-03-23T00:00:00Z',
            },
          ],
          error: null,
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null })),
      })),
    })),
    rpc: jest.fn(() => ({
      error: null,
    })),
  } as unknown as SupabaseClient

  let guideStorage: GuideStorage

  beforeEach(() => {
    jest.clearAllMocks()
    guideStorage = new GuideStorage(mockSupabase)
  })

  describe('createGuide', () => {
    it('should create a new guide', async () => {
      const result = await guideStorage.createGuide(mockVideoId, mockUserId)

      expect(result).toEqual({ id: mockGuideId })
      expect(mockSupabase.from).toHaveBeenCalledWith('video_guides')
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        video_id: mockVideoId,
        user_id: mockUserId,
        status: 'generating',
      })
    })

    it('should handle database errors', async () => {
      const mockError = new Error('Database error')
      mockSupabase.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              error: mockError,
            })),
          })),
        })),
      }))

      await expect(guideStorage.createGuide(mockVideoId, mockUserId))
        .rejects.toThrow('Failed to create guide')
      expect(logger.error).toHaveBeenCalledWith('Error creating guide:', mockError)
    })
  })

  describe('updateGuide', () => {
    it('should update guide with sections', async () => {
      await guideStorage.updateGuide(mockGuideId, mockGuide)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('update_guide', {
        p_guide_id: mockGuideId,
        p_title: mockGuide.title,
        p_summary: mockGuide.summary,
        p_keywords: mockGuide.keywords,
        p_difficulty: mockGuide.difficulty,
        p_sections: mockGuide.sections,
        p_status: 'completed',
      })
    })

    it('should handle database errors', async () => {
      const mockError = new Error('Database error')
      mockSupabase.rpc = jest.fn(() => ({
        error: mockError,
      }))

      await expect(guideStorage.updateGuide(mockGuideId, mockGuide))
        .rejects.toThrow('Failed to update guide')
      expect(logger.error).toHaveBeenCalledWith('Error updating guide:', mockError)
    })
  })

  describe('markGuideError', () => {
    it('should mark guide as failed', async () => {
      const errorMessage = 'Test error'
      await guideStorage.markGuideError(mockGuideId, errorMessage)

      expect(mockSupabase.from).toHaveBeenCalledWith('video_guides')
      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        status: 'error',
        error: errorMessage,
      })
    })

    it('should handle database errors', async () => {
      const mockError = new Error('Database error')
      mockSupabase.from = jest.fn(() => ({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: mockError })),
        })),
      }))

      await expect(guideStorage.markGuideError(mockGuideId, 'Test error'))
        .rejects.toThrow('Failed to update guide status')
      expect(logger.error).toHaveBeenCalledWith('Error marking guide as failed:', mockError)
    })
  })

  describe('getGuideMetadata', () => {
    it('should get guide metadata', async () => {
      const metadata = await guideStorage.getGuideMetadata(mockGuideId)

      expect(metadata).toEqual({
        id: mockGuideId,
        videoId: mockVideoId,
        title: mockGuide.title,
        summary: mockGuide.summary,
        keywords: mockGuide.keywords,
        difficulty: mockGuide.difficulty,
        status: 'completed',
        createdAt: '2024-03-23T00:00:00Z',
        updatedAt: '2024-03-23T00:00:00Z',
        userId: mockUserId,
      })
    })

    it('should handle non-existent guide', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: null,
              error: null,
            })),
          })),
        })),
      }))

      await expect(guideStorage.getGuideMetadata(mockGuideId))
        .rejects.toThrow('Guide not found')
    })
  })

  describe('getGuideContent', () => {
    it('should get guide content with sections', async () => {
      const content = await guideStorage.getGuideContent(mockGuideId)

      expect(content).toEqual({
        guideId: mockGuideId,
        sections: mockGuide.sections,
      })
    })

    it('should handle database errors', async () => {
      const mockError = new Error('Database error')
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              error: mockError,
            })),
          })),
        })),
      }))

      await expect(guideStorage.getGuideContent(mockGuideId))
        .rejects.toThrow('Failed to get guide content')
      expect(logger.error).toHaveBeenCalledWith('Error getting guide content:', mockError)
    })
  })

  describe('deleteGuide', () => {
    it('should delete guide', async () => {
      await guideStorage.deleteGuide(mockGuideId)

      expect(mockSupabase.from).toHaveBeenCalledWith('video_guides')
      expect(mockSupabase.from().delete).toHaveBeenCalled()
    })

    it('should handle database errors', async () => {
      const mockError = new Error('Database error')
      mockSupabase.from = jest.fn(() => ({
        delete: jest.fn(() => ({
          eq: jest.fn(() => ({ error: mockError })),
        })),
      }))

      await expect(guideStorage.deleteGuide(mockGuideId))
        .rejects.toThrow('Failed to delete guide')
      expect(logger.error).toHaveBeenCalledWith('Error deleting guide:', mockError)
    })
  })

  describe('listGuides', () => {
    it('should list all guides for user', async () => {
      const guides = await guideStorage.listGuides(mockUserId)

      expect(guides).toEqual([
        {
          id: mockGuideId,
          videoId: mockVideoId,
          title: mockGuide.title,
          summary: mockGuide.summary,
          keywords: mockGuide.keywords,
          difficulty: mockGuide.difficulty,
          status: 'completed',
          createdAt: '2024-03-23T00:00:00Z',
          updatedAt: '2024-03-23T00:00:00Z',
          userId: mockUserId,
        },
      ])
    })

    it('should filter guides by video ID', async () => {
      await guideStorage.listGuides(mockUserId, mockVideoId)

      expect(mockSupabase.from().select().eq).toHaveBeenCalledWith('video_id', mockVideoId)
    })

    it('should handle database errors', async () => {
      const mockError = new Error('Database error')
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              error: mockError,
            })),
          })),
        })),
      }))

      await expect(guideStorage.listGuides(mockUserId))
        .rejects.toThrow('Failed to list guides')
      expect(logger.error).toHaveBeenCalledWith('Error listing guides:', mockError)
    })
  })
}) 