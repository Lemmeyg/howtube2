import { ProcessingQueue, QueueItem } from '../queue'
import { VideoStorage } from '../storage'
import { SupabaseClient } from '@supabase/supabase-js'

// Mock dependencies
jest.mock('../storage')
jest.mock('@/config/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}))

describe('ProcessingQueue', () => {
  const mockUserId = 'test-user-123'
  const mockVideoId = 'test-video-123'
  const mockUrl = 'https://www.youtube.com/watch?v=test123'
  const mockQueueItem: QueueItem = {
    id: 'test-queue-123',
    userId: mockUserId,
    videoId: mockVideoId,
    url: mockUrl,
    status: 'pending',
    progress: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockSupabase = {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({ data: mockQueueItem, error: null })),
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: mockQueueItem, error: null })),
        })),
        order: jest.fn(() => ({ data: [mockQueueItem], error: null })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null })),
        lt: jest.fn(() => ({
          in: jest.fn(() => ({
            select: jest.fn(() => ({ data: [{ video_id: mockVideoId }], error: null })),
          })),
        })),
      })),
    })),
  } as unknown as SupabaseClient

  let queue: ProcessingQueue

  beforeEach(() => {
    jest.clearAllMocks()
    queue = new ProcessingQueue(mockSupabase)
  })

  describe('addToQueue', () => {
    it('should add a video to the queue', async () => {
      const result = await queue.addToQueue(mockUserId, mockUrl, mockVideoId)
      expect(result).toEqual(mockQueueItem)
      expect(mockSupabase.from).toHaveBeenCalledWith('video_processing')
    })

    it('should handle database errors', async () => {
      mockSupabase
        .from()
        .insert()
        .select()
        .single.mockImplementationOnce(() => ({
          data: null,
          error: new Error('Database error'),
        }))

      await expect(queue.addToQueue(mockUserId, mockUrl, mockVideoId)).rejects.toThrow(
        'Failed to add video to queue'
      )
    })
  })

  describe('getStatus', () => {
    it('should get video status from queue', async () => {
      const result = await queue.getStatus(mockVideoId)
      expect(result).toEqual(mockQueueItem)
    })

    it('should return null for non-existent video', async () => {
      mockSupabase
        .from()
        .select()
        .eq()
        .single.mockImplementationOnce(() => ({
          data: null,
          error: { code: 'PGRST116' },
        }))

      const result = await queue.getStatus(mockVideoId)
      expect(result).toBeNull()
    })
  })

  describe('updateStatus', () => {
    it('should update video status in queue', async () => {
      await queue.updateStatus(mockVideoId, 'downloading', 50, {
        speed: '1MB/s',
        eta: '00:01:00',
      })

      expect(mockSupabase.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'downloading',
          progress: 50,
          speed: '1MB/s',
          eta: '00:01:00',
        })
      )
    })
  })

  describe('removeFromQueue', () => {
    it('should remove video from queue and delete files', async () => {
      await queue.removeFromQueue(mockVideoId)
      expect(mockSupabase.from().delete().eq).toHaveBeenCalledWith('video_id', mockVideoId)
      expect(VideoStorage.deleteVideo).toHaveBeenCalledWith(mockVideoId)
    })
  })

  describe('getUserQueue', () => {
    it('should get all videos in user queue', async () => {
      const result = await queue.getUserQueue(mockUserId)
      expect(result).toEqual([mockQueueItem])
      expect(mockSupabase.from().select().eq).toHaveBeenCalledWith('user_id', mockUserId)
    })
  })

  describe('cleanupOldRecords', () => {
    it('should cleanup old records and their files', async () => {
      await queue.cleanupOldRecords(24)
      expect(mockSupabase.from().delete().lt).toHaveBeenCalled()
      expect(VideoStorage.deleteVideo).toHaveBeenCalledWith(mockVideoId)
    })
  })
})
