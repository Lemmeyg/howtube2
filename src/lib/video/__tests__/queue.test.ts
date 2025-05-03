import { ProcessingQueue, ProcessingStatus } from '../queue'
import { createClient } from '@supabase/supabase-js'
import { QueueItem } from '../types'
import { createMockSupabaseClient } from '../../../test/mocks/supabase'
// import type { SupabaseClient } from '@supabase/supabase-js'
// import type { PostgrestQueryBuilder } from '@supabase/postgrest-js'

jest.mock('@supabase/supabase-js')

describe('ProcessingQueue', () => {
  const mockVideoId = 'test-video-id'
  const mockUserId = 'test-user-id'
  const mockQueueItem: QueueItem = {
    id: 1,
    user_id: mockUserId,
    video_id: mockVideoId,
    status: 'pending',
    progress: undefined,
    error: undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const expectedQueueItem = {
    id: 1,
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
  let mockSupabase: unknown
  let mockQueryBuilder: unknown

  beforeEach(() => {
    jest.clearAllMocks()
    const { client, queryBuilder } = createMockSupabaseClient()
    mockSupabase = client
    mockQueryBuilder = queryBuilder
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
    queue = new ProcessingQueue(mockSupabase)
  })

  describe('addToQueue', () => {
    it('should add a video to the queue', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: mockQueueItem, error: null })
      const result = await queue.addToQueue(mockUserId, 'mock-url', mockVideoId)

      expect(mockSupabase.from).toHaveBeenCalledWith('video_processing')
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        user_id: mockUserId,
        video_id: mockVideoId,
        url: 'mock-url',
        status: 'pending',
        progress: 0,
      })
      expect(result).toEqual(expectedQueueItem)
    })

    it('should handle database error', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: new Error('Database error') })
      await expect(queue.addToQueue(mockUserId, 'mock-url', mockVideoId)).rejects.toThrow('Failed to add video to queue')
    })
  })

  describe('updateStatus', () => {
    it('should update video status', async () => {
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
      mockQueryBuilder.update.mockReturnValueOnce({ error: new Error('Database error') })
      const status: ProcessingStatus = 'downloaded'
      const progress = 100
      const details = {}
      await expect(queue.updateStatus(mockVideoId, status, progress, details)).rejects.toThrow('Failed to update video status')
    })
  })

  describe('getUserQueue', () => {
    it('should list user queue items', async () => {
      mockQueryBuilder.order.mockResolvedValueOnce({ data: [mockQueueItem], error: null })
      const result = await queue.getUserQueue(mockUserId)

      expect(mockSupabase.from).toHaveBeenCalledWith('video_processing')
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', mockUserId)
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(result).toEqual([expectedQueueItem])
    })

    it('should handle database error', async () => {
      mockQueryBuilder.order.mockResolvedValueOnce({ data: null, error: new Error('Database error') })
      await expect(queue.getUserQueue(mockUserId)).rejects.toThrow('Failed to get user queue')
    })
  })
})


