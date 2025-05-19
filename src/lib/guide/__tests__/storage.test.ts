import { createMockSupabaseClient } from '../../../test/mocks/supabase'
import { GuideStorage } from '../storage'
import { Guide } from '../openai'
import { createClient } from '@supabase/supabase-js'

// Mock dependencies
jest.mock('@/config/logger')
jest.mock('@supabase/supabase-js')

describe('GuideStorage', () => {
  const mockVideoId = 'test-video-id'
  const mockUserId = 'test-user-id'
  const mockGuideId = 'test-guide-id'

  const mockGuide: Guide = {
    title: 'Test Guide',
    summary: 'Test Summary',
    sections: [
      {
        title: 'Section 1',
        content: 'Section 1 content',
      },
    ],
    keywords: ['test', 'guide'],
    difficulty: 'intermediate',
  }

  const mockGuideMetadataSnake = {
    id: mockGuideId,
    user_id: mockUserId,
    video_id: mockVideoId,
    title: mockGuide.title,
    summary: mockGuide.summary,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    keywords: mockGuide.keywords,
    difficulty: mockGuide.difficulty,
    status: 'completed',
    error: undefined,
  }

  const mockGuideMetadata = {
    id: mockGuideId,
    userId: mockUserId,
    videoId: mockVideoId,
    title: mockGuide.title,
    summary: mockGuide.summary,
    createdAt: mockGuideMetadataSnake.created_at,
    updatedAt: mockGuideMetadataSnake.updated_at,
    keywords: mockGuide.keywords,
    difficulty: mockGuide.difficulty,
    status: 'completed',
    error: undefined,
  }

  let storage: GuideStorage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockQueryBuilder: any

  beforeEach(() => {
    jest.clearAllMocks()
    const { client, queryBuilder } = createMockSupabaseClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSupabase = client as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockQueryBuilder = queryBuilder as any
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
    mockSupabase.rpc = jest.fn()
    mockSupabase.from = jest.fn(() => mockQueryBuilder)
    mockQueryBuilder.delete = jest.fn().mockReturnThis()
    mockQueryBuilder.eq = jest.fn().mockReturnThis()
    storage = new GuideStorage(mockSupabase)
  })

  describe('createGuide', () => {
    it('should create a new guide', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: { id: mockGuideId }, error: null })
      const result = await storage.createGuide(mockVideoId, mockUserId)

      expect(mockSupabase.from).toHaveBeenCalledWith('guides')
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        video_id: mockVideoId,
        user_id: mockUserId,
        status: 'generating',
      } as Record<string, unknown>)
      expect(result as Record<string, unknown>).toEqual({ id: mockGuideId })
    })

    it('should handle database error', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error'),
      })
      await expect(storage.createGuide(mockVideoId, mockUserId)).rejects.toThrow(
        'Failed to create guide'
      )
    })
  })

  describe('updateGuide', () => {
    it('should update an existing guide', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ error: null })
      const result = await storage.updateGuide(mockGuideId, mockGuide)

      expect(mockSupabase.rpc).toHaveBeenCalled()
      expect(result).toBeUndefined()
    })

    it('should handle database error', async () => {
      mockQueryBuilder.then = jest.fn().mockImplementation((resolve: (value: unknown) => void) => {
        resolve({ data: null, error: new Error('Database error') })
        return Promise.resolve({ data: null, error: new Error('Database error') })
      })

      await expect(storage.updateGuide(mockGuideId, mockGuide)).rejects.toThrow(
        'Failed to update guide'
      )
    })
  })

  describe('getGuideMetadata', () => {
    it('should get guide metadata', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: mockGuideMetadataSnake, error: null })
      const result = await storage.getGuideMetadata(mockGuideId)

      expect(mockSupabase.from).toHaveBeenCalledWith('guides')
      expect(mockQueryBuilder.select).toHaveBeenCalled()
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', mockGuideId)
      expect(mockQueryBuilder.single).toHaveBeenCalled()
      expect(result).toEqual(mockGuideMetadata)
    })

    it('should handle database error', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error'),
      })
      await expect(storage.getGuideMetadata(mockGuideId)).rejects.toThrow(
        'Failed to get guide metadata'
      )
    })
  })

  describe('getGuideContent', () => {
    it('should get guide content', async () => {
      mockSupabase.from.mockReturnValueOnce(mockQueryBuilder)
      mockQueryBuilder.select.mockReturnThis()
      mockQueryBuilder.eq.mockReturnThis()
      mockQueryBuilder.order.mockResolvedValueOnce({
        data: [{ title: mockGuide.title, content: mockGuide.sections[0].content }],
        error: null,
      })
      const result = await storage.getGuideContent(mockGuideId)

      expect(mockSupabase.from).toHaveBeenCalledWith('guide_sections')
      expect(mockQueryBuilder.select).toHaveBeenCalled()
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('guide_id', mockGuideId)
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('section_order', { ascending: true })
      expect(result).toEqual({
        guideId: mockGuideId,
        sections: [{ title: mockGuide.title, content: mockGuide.sections[0].content }],
      })
    })

    it('should handle database error', async () => {
      mockSupabase.from.mockReturnValueOnce(mockQueryBuilder)
      mockQueryBuilder.select.mockReturnThis()
      mockQueryBuilder.eq.mockReturnThis()
      mockQueryBuilder.order.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error'),
      })
      await expect(storage.getGuideContent(mockGuideId)).rejects.toThrow(
        'Failed to get guide content'
      )
    })
  })

  describe('deleteGuide', () => {
    it('should delete a guide', async () => {
      mockQueryBuilder.delete = jest.fn().mockReturnThis()
      mockQueryBuilder.eq = jest.fn().mockImplementation(() => Promise.resolve({ error: null }))
      await storage.deleteGuide(mockGuideId)

      expect(mockSupabase.from).toHaveBeenCalledWith('guides')
      expect(mockQueryBuilder.delete).toHaveBeenCalled()
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', mockGuideId)
    })

    it('should handle database error', async () => {
      mockQueryBuilder.delete = jest.fn().mockReturnThis()
      mockQueryBuilder.eq = jest
        .fn()
        .mockImplementation(() => Promise.resolve({ error: new Error('Database error') }))
      await expect(storage.deleteGuide(mockGuideId)).rejects.toThrow('Failed to delete guide')
    })
  })

  describe('listGuides', () => {
    it('should list user guides', async () => {
      mockQueryBuilder.order.mockReturnValueOnce(
        Promise.resolve({ data: [mockGuideMetadataSnake], error: null })
      )
      const result = await storage.listGuides(mockUserId)

      expect(mockSupabase.from).toHaveBeenCalledWith('guides')
      expect(mockQueryBuilder.select).toHaveBeenCalled()
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', mockUserId)
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(result).toEqual([mockGuideMetadata])
    })

    it('should handle database error', async () => {
      mockQueryBuilder.order.mockReturnValueOnce(
        Promise.resolve({ data: null, error: new Error('Database error') })
      )
      await expect(storage.listGuides(mockUserId)).rejects.toThrow('Failed to list guides')
    })
  })
})
