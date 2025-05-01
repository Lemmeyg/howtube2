import { createServerClient } from '@/lib/supabase/server'
import { ProcessingQueue } from '@/lib/video/queue'
import { MetadataExtractor } from '@/lib/video/metadata'
import { POST, GET, DELETE } from '../route'

// Mock the external dependencies
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
}))

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}))

jest.mock('@/lib/auth/protect-api', () => ({
  protectApi: jest.fn(handler => handler()),
}))

jest.mock('@/lib/video/queue')
jest.mock('@/lib/video/metadata')

describe('Video Processing API Route', () => {
  const mockUserId = 'test-user-id'
  const mockVideoId = 'dQw4w9WgXcQ'
  const mockUrl = `https://www.youtube.com/watch?v=${mockVideoId}`

  const mockSession = {
    user: {
      id: mockUserId,
    },
  }

  const mockQueueItem = {
    id: 'test-queue-id',
    userId: mockUserId,
    videoId: mockVideoId,
    url: mockUrl,
    status: 'pending',
    progress: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockMetadata = {
    id: mockVideoId,
    title: 'Test Video',
    description: 'Test Description',
    duration: 180,
    thumbnail: 'https://example.com/thumb.jpg',
    formats: [],
    uploadDate: '20240321',
    uploader: 'Test Channel',
    uploaderUrl: 'https://youtube.com/channel/test',
    viewCount: 1000,
    likeCount: 100,
    tags: ['test'],
  }

  const mockSupabase = {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: mockSession } })),
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(ProcessingQueue as jest.Mock).mockImplementation(() => ({
      addToQueue: jest.fn().mockResolvedValue(mockQueueItem),
      getStatus: jest.fn().mockResolvedValue(mockQueueItem),
      removeFromQueue: jest.fn().mockResolvedValue(undefined),
    }))
    ;(MetadataExtractor as jest.Mock).mockImplementation(() => ({
      extractMetadata: jest.fn().mockResolvedValue(mockMetadata),
      saveMetadata: jest.fn().mockResolvedValue(undefined),
      getMetadata: jest.fn().mockResolvedValue(mockMetadata),
      deleteMetadata: jest.fn().mockResolvedValue(undefined),
    }))
  })

  describe('POST /api/videos/process', () => {
    it('should add video to processing queue', async () => {
      const request = new Request('http://localhost/api/videos/process', {
        method: 'POST',
        body: JSON.stringify({ url: mockUrl }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        message: 'Video added to processing queue',
        status: mockQueueItem,
        metadata: mockMetadata,
      })
    })

    it('should handle invalid YouTube URL', async () => {
      const request = new Request('http://localhost/api/videos/process', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('should handle duplicate video', async () => {
      const request = new Request('http://localhost/api/videos/process', {
        method: 'POST',
        body: JSON.stringify({ url: mockUrl }),
      })

      ;(ProcessingQueue as jest.Mock).mockImplementation(() => ({
        getStatus: jest.fn().mockResolvedValue(mockQueueItem),
      }))

      const response = await POST(request)
      expect(response.status).toBe(409)
    })
  })

  describe('GET /api/videos/process', () => {
    it('should get video status and metadata', async () => {
      const request = new Request(`http://localhost/api/videos/process?videoId=${mockVideoId}`, {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        status: mockQueueItem,
        metadata: mockMetadata,
      })
    })

    it('should handle missing video ID', async () => {
      const request = new Request('http://localhost/api/videos/process', {
        method: 'GET',
      })

      const response = await GET(request)
      expect(response.status).toBe(400)
    })

    it('should handle non-existent video', async () => {
      const request = new Request(`http://localhost/api/videos/process?videoId=${mockVideoId}`, {
        method: 'GET',
      })

      ;(ProcessingQueue as jest.Mock).mockImplementation(() => ({
        getStatus: jest.fn().mockResolvedValue(null),
      }))

      const response = await GET(request)
      expect(response.status).toBe(404)
    })
  })

  describe('DELETE /api/videos/process', () => {
    it('should remove video from queue', async () => {
      const request = new Request(`http://localhost/api/videos/process?videoId=${mockVideoId}`, {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        message: 'Video removed from queue',
      })
    })

    it('should handle missing video ID', async () => {
      const request = new Request('http://localhost/api/videos/process', {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      expect(response.status).toBe(400)
    })

    it('should handle non-existent video', async () => {
      const request = new Request(`http://localhost/api/videos/process?videoId=${mockVideoId}`, {
        method: 'DELETE',
      })

      ;(ProcessingQueue as jest.Mock).mockImplementation(() => ({
        getStatus: jest.fn().mockResolvedValue(null),
      }))

      const response = await DELETE(request)
      expect(response.status).toBe(404)
    })

    it('should handle unauthorized deletion', async () => {
      const request = new Request(`http://localhost/api/videos/process?videoId=${mockVideoId}`, {
        method: 'DELETE',
      })

      ;(ProcessingQueue as jest.Mock).mockImplementation(() => ({
        getStatus: jest.fn().mockResolvedValue({
          ...mockQueueItem,
          userId: 'different-user-id',
        }),
      }))

      const response = await DELETE(request)
      expect(response.status).toBe(403)
    })
  })
})
