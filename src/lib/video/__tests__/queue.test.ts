import { ProcessingQueue, ProcessingStatus } from '../queue'
import { createClient } from '@supabase/supabase-js'
import { QueueItem } from '../types'
// import type { SupabaseClient } from '@supabase/supabase-js'
// import type { PostgrestQueryBuilder } from '@supabase/postgrest-js'

jest.mock('@supabase/supabase-js')

describe('ProcessingQueue', () => {
  const mockVideoId = 'test-video-id'
  const mockUserId = 'test-user-id'
  const mockQueueItem: QueueItem = {
    id: 'mock-uuid-1',
    user_id: mockUserId,
    video_id: mockVideoId,
    status: 'pending',
    progress: undefined,
    error: undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const expectedQueueItem = {
    id: 'mock-uuid-1',
    userId: mockUserId,
    videoId: mockVideoId,
    url: undefined,
    status: 'pending',
    progress: undefined,
    speed: undefined,
    eta: undefined,
    size: undefined,
    error: undefined,
    createdAt: expect.any(Date),
    updatedAt: expect.any(Date),
  }

  let queue: ProcessingQueue
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockQueryBuilder: any

  beforeEach(() => {
    jest.clearAllMocks()
    // Create a fully chainable mockQueryBuilder and mock Supabase client
    /* eslint-disable @typescript-eslint/no-explicit-any */
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      then: undefined,
      catch: undefined,
      url: new URL('http://localhost'),
      headers: {},
    } as any
    mockSupabase = {
      from: jest.fn(() => mockQueryBuilder),
      auth: {
        getSession: jest
          .fn()
          .mockResolvedValue({ data: { session: { user: { id: mockUserId } } } }),
      },
    } as any
    /* eslint-enable @typescript-eslint/no-explicit-any */
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
    queue = new ProcessingQueue(mockSupabase)
  })

  describe('addToQueue', () => {
    it('should add a video to the queue', async () => {
      mockQueryBuilder.insert.mockReturnThis()
      mockQueryBuilder.select.mockReturnThis()
      mockQueryBuilder.single.mockResolvedValueOnce({ data: mockQueueItem, error: null })
      const result = await queue.addToQueue(mockUserId, 'mock-url', mockVideoId)

      expect(mockSupabase.from).toHaveBeenCalledWith('video_processing')
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        user_id: mockUserId,
        video_id: mockVideoId,
        video_url: 'mock-url',
        status: 'pending',
        progress: 0,
      })
      expect(result).toEqual(expectedQueueItem)
    })

    it('should handle database error', async () => {
      mockQueryBuilder.insert.mockReturnThis()
      mockQueryBuilder.select.mockReturnThis()
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error'),
      })
      await expect(queue.addToQueue(mockUserId, 'mock-url', mockVideoId)).rejects.toThrow(
        'Failed to add video to queue'
      )
    })
  })

  describe('updateStatus', () => {
    it('should update video status', async () => {
      mockQueryBuilder.update.mockReturnThis()
      mockQueryBuilder.eq.mockResolvedValueOnce({ error: null })
      const status: ProcessingStatus = 'downloaded'
      const progress = 100
      const details = {}
      await queue.updateStatus(mockVideoId, status, progress, details)

      expect(mockSupabase.from).toHaveBeenCalledWith('video_processing')
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('video_id', mockVideoId)
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        status,
        progress,
        updated_at: expect.any(String),
      })
    })

    it('should handle database error', async () => {
      mockQueryBuilder.update.mockReturnThis()
      mockQueryBuilder.eq.mockResolvedValueOnce({ error: new Error('Database error') })
      const status: ProcessingStatus = 'downloaded'
      const progress = 100
      const details = {}
      await expect(queue.updateStatus(mockVideoId, status, progress, details)).rejects.toThrow(
        'Failed to update video status'
      )
    })
  })

  describe('getUserQueue', () => {
    it('should list user queue items', async () => {
      mockQueryBuilder.eq.mockReturnThis()
      mockQueryBuilder.order.mockResolvedValueOnce({ data: [mockQueueItem], error: null })
      const result = await queue.getUserQueue(mockUserId)

      expect(mockSupabase.from).toHaveBeenCalledWith('video_processing')
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', mockUserId)
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(result).toEqual([expectedQueueItem])
    })

    it('should handle database error', async () => {
      mockQueryBuilder.eq.mockReturnThis()
      mockQueryBuilder.order.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error'),
      })
      await expect(queue.getUserQueue(mockUserId)).rejects.toThrow('Failed to get user queue')
    })
  })
})
