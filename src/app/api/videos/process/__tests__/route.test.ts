// Polyfill global Request and Response for Node.js test environment
import { Request as NodeFetchRequest, Response as NodeFetchResponse } from 'node-fetch'
;(global as unknown as { Request: typeof NodeFetchRequest }).Request = NodeFetchRequest
;(global as unknown as { Response: typeof NodeFetchResponse }).Response = NodeFetchResponse

// Use node-fetch v2 (CommonJS) for Response
// const NodeFetchResponse = require('node-fetch').Response;

jest.mock('next/server', () => ({
  NextResponse: NodeFetchResponse,
}))

// Mock dependencies
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
}))

jest.mock('@/lib/supabase/server')
jest.mock('@/lib/video/queue')
jest.mock('@/lib/video/metadata')

// Mock protectApi to properly handle Response objects
jest.mock('@/lib/auth/protect-api', () => {
  return {
    protectApi: jest.fn(async handler => {
      try {
        const response = await handler()
        if (response instanceof NodeFetchResponse) {
          return response
        }
        return response
      } catch (error) {
        let stack: string | undefined
        if (
          typeof error === 'object' &&
          error !== null &&
          'stack' in error &&
          typeof (error as { stack: unknown }).stack === 'string'
        ) {
          stack = (error as { stack: string }).stack
        }
        console.error('protectApi mock error:', stack ?? error)
        return new NodeFetchResponse(JSON.stringify({ error: 'Internal Server Error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }),
  }
})

import { createServerClient } from '@/lib/supabase/server'
import { ProcessingQueue } from '@/lib/video/queue'
import { MetadataExtractor } from '@/lib/video/metadata'
import * as routeModule from '../route'
import { VideoMetadata } from '@/lib/video/types'

describe('Video Processing API Route', () => {
  const mockUserId = 'test-user-id'
  const mockVideoId = 'dQw4w9WgXcQ'
  const mockUrl = `https://www.youtube.com/watch?v=${mockVideoId}`
  const mockQueueItem = {
    id: 'test-queue-123',
    userId: mockUserId,
    videoId: mockVideoId,
    url: mockUrl,
    status: 'pending',
    progress: 0,
    createdAt: new Date('2025-05-02T16:07:59.680Z').toISOString(),
    updatedAt: new Date('2025-05-02T16:07:59.680Z').toISOString(),
  }
  const mockMetadata: VideoMetadata = {
    id: mockVideoId,
    title: 'Test Video',
    description: 'Test Description',
    duration: 180,
    thumbnailUrl: 'https://example.com/thumbnail.jpg',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(ProcessingQueue.prototype.getStatus as jest.Mock).mockResolvedValue(null)
    ;(ProcessingQueue.prototype.updateStatus as jest.Mock).mockResolvedValue(mockQueueItem)
    ;(ProcessingQueue.prototype.removeFromQueue as jest.Mock).mockResolvedValue(mockQueueItem)
    ;(ProcessingQueue.prototype.addToQueue as jest.Mock).mockResolvedValue(mockQueueItem)
    ;(MetadataExtractor.prototype.extractMetadata as jest.Mock).mockResolvedValue(mockMetadata)
    ;(MetadataExtractor.prototype.getMetadata as jest.Mock).mockResolvedValue(mockMetadata)
    ;(MetadataExtractor.prototype.saveMetadata as jest.Mock).mockResolvedValue(undefined)
    ;(createServerClient as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn(() =>
          Promise.resolve({ data: { session: { user: { id: mockUserId } } }, error: null })
        ),
      },
      from: jest.fn((table: string) => {
        type QueryBuilder = {
          insert?: jest.Mock
          select?: jest.Mock
          single?: jest.Mock
          update?: jest.Mock
          eq?: jest.Mock
          delete?: jest.Mock
          order?: jest.Mock
          lt?: jest.Mock
          in?: jest.Mock
        }
        if (table === 'video_processing') {
          const builder: QueryBuilder = {
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockQueueItem, error: null }),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            lt: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
          }
          return builder
        }
        if (table === 'video_metadata') {
          const builder: QueryBuilder = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockMetadata, error: null }),
          }
          return builder
        }
        // Default mock for any other table
        const builder: QueryBuilder = {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: {}, error: null }),
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          delete: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          lt: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
        }
        return builder
      }),
    })
  })

  describe('POST /api/videos/process', () => {
    it('should add video to processing queue', async () => {
      const request = new Request('http://localhost/api/videos/process', {
        method: 'POST',
        body: JSON.stringify({ url: mockUrl }),
      })

      const response = await POSTWrapper(request)
      expect(response).toBeInstanceOf(NodeFetchResponse)
      expect(response.status).toBe(200)
      const data = await response.json()
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

      const response = await POSTWrapper(request)
      expect(response).toBeInstanceOf(NodeFetchResponse)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data).toEqual({
        error: 'Invalid YouTube URL',
      })
    })

    it('should handle duplicate video', async () => {
      ;(ProcessingQueue.prototype.getStatus as jest.Mock).mockResolvedValueOnce(mockQueueItem)

      const request = new Request('http://localhost/api/videos/process', {
        method: 'POST',
        body: JSON.stringify({ url: mockUrl }),
      })

      const response = await POSTWrapper(request)
      expect(response).toBeInstanceOf(NodeFetchResponse)
      expect(response.status).toBe(409)

      const data = await response.json()
      expect(data).toEqual({
        error: 'Video is already being processed',
        status: mockQueueItem,
      })
    })
  })

  describe('GET /api/videos/process', () => {
    it('should get video status and metadata', async () => {
      ;(ProcessingQueue.prototype.getStatus as jest.Mock).mockResolvedValueOnce(mockQueueItem)
      const request = new Request(`http://localhost/api/videos/process?videoId=${mockVideoId}`)
      const response = await GETWrapper(request)
      expect(response).toBeInstanceOf(NodeFetchResponse)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toEqual({
        status: mockQueueItem,
        metadata: mockMetadata,
      })
    })

    it('should handle missing video ID', async () => {
      const request = new Request('http://localhost/api/videos/process')

      const response = await GETWrapper(request)
      expect(response).toBeInstanceOf(NodeFetchResponse)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data).toEqual({
        error: 'Video ID is required',
      })
    })

    it('should handle non-existent video', async () => {
      ;(ProcessingQueue.prototype.getStatus as jest.Mock).mockResolvedValueOnce(null)

      const request = new Request(`http://localhost/api/videos/process?videoId=${mockVideoId}`)

      const response = await GETWrapper(request)
      expect(response).toBeInstanceOf(NodeFetchResponse)
      expect(response.status).toBe(404)

      const data = await response.json()
      expect(data).toEqual({
        error: 'Video not found in queue',
      })
    })
  })

  describe('DELETE /api/videos/process', () => {
    it('should remove video from queue', async () => {
      ;(ProcessingQueue.prototype.getStatus as jest.Mock).mockResolvedValueOnce(mockQueueItem)
      const request = new Request(`http://localhost/api/videos/process?videoId=${mockVideoId}`, {
        method: 'DELETE',
      })
      const response = await DELETEWrapper(request)
      expect(response).toBeInstanceOf(NodeFetchResponse)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toEqual({
        message: 'Video removed from queue',
      })
      // Verify the queue operations were called
      expect(ProcessingQueue.prototype.getStatus).toHaveBeenCalledWith(mockVideoId)
      expect(ProcessingQueue.prototype.removeFromQueue).toHaveBeenCalledWith(mockVideoId)
      expect(MetadataExtractor.prototype.deleteMetadata).toHaveBeenCalledWith(mockVideoId)
    })

    it('should handle missing video ID', async () => {
      const request = new Request('http://localhost/api/videos/process', {
        method: 'DELETE',
      })

      const response = await DELETEWrapper(request)
      expect(response).toBeInstanceOf(NodeFetchResponse)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data).toEqual({
        error: 'Video ID is required',
      })
    })

    it('should handle non-existent video', async () => {
      ;(ProcessingQueue.prototype.getStatus as jest.Mock).mockResolvedValueOnce(null)

      const request = new Request(`http://localhost/api/videos/process?videoId=${mockVideoId}`, {
        method: 'DELETE',
      })

      const response = await DELETEWrapper(request)
      expect(response).toBeInstanceOf(NodeFetchResponse)
      expect(response.status).toBe(404)

      const data = await response.json()
      expect(data).toEqual({
        error: 'Video not found in queue',
      })
    })

    it('should handle unauthorized deletion', async () => {
      ;(ProcessingQueue.prototype.getStatus as jest.Mock).mockResolvedValueOnce({
        ...mockQueueItem,
        userId: 'different-user-id',
      })

      const request = new Request(`http://localhost/api/videos/process?videoId=${mockVideoId}`, {
        method: 'DELETE',
      })

      const response = await DELETEWrapper(request)
      expect(response).toBeInstanceOf(NodeFetchResponse)
      expect(response.status).toBe(403)

      const data = await response.json()
      expect(data).toEqual({
        error: 'Unauthorized',
      })
    })
  })
})

// Handler wrappers for logging
function POSTWrapper(request: Request) {
  console.log('POST handler called with:', request)
  return routeModule.POST(request)
}
function GETWrapper(request: Request) {
  console.log('GET handler called with:', request)
  return routeModule.GET(request)
}
function DELETEWrapper(request: Request) {
  console.log('DELETE handler called with:', request)
  return routeModule.DELETE(request)
}
