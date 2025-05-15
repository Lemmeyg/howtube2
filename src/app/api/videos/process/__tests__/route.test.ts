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
    getAll: jest.fn(() => []),
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

import { createServerActionSupabaseClient } from '@/lib/supabase/server'
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
    user_id: mockUserId,
    video_id: mockVideoId,
    video_url: mockUrl,
    status: 'pending',
    progress: 0,
    created_at: new Date('2025-05-02T16:07:59.680Z').toISOString(),
    updated_at: new Date('2025-05-02T16:07:59.680Z').toISOString(),
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
    ;(MetadataExtractor.prototype.getMetadataById as jest.Mock).mockResolvedValue(mockMetadata)
    ;(MetadataExtractor.prototype.saveMetadata as jest.Mock).mockResolvedValue(undefined)
    ;(createServerActionSupabaseClient as jest.Mock).mockReturnValue({
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
            single: jest.fn().mockReturnThis(),
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
      // Simulate video not in queue, then return inserted row
      ;(createServerActionSupabaseClient as jest.Mock).mockReturnValueOnce({
        auth: {
          getSession: jest.fn(() =>
            Promise.resolve({ data: { session: { user: { id: mockUserId } } }, error: null })
          ),
        },
        from: jest.fn((table: string) => {
          if (table === 'video_processing') {
            return {
              insert: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest
                .fn()
                .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
                .mockResolvedValueOnce({ data: mockQueueItem, error: null }),
              update: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              delete: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              lt: jest.fn().mockReturnThis(),
              in: jest.fn().mockReturnThis(),
            }
          }
          if (table === 'video_metadata') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: mockMetadata, error: null }),
            }
          }
          return {}
        }),
      })
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
        status: expect.any(Object),
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
      // Simulate video already in queue, but for a different user
      const duplicateQueueItem: typeof mockQueueItem = { ...mockQueueItem, user_id: 'other-user' }
      ;(createServerActionSupabaseClient as jest.Mock).mockReturnValueOnce({
        auth: {
          getSession: jest.fn(() =>
            Promise.resolve({ data: { session: { user: { id: mockUserId } } }, error: null })
          ),
        },
        from: jest.fn((table: string) => {
          if (table === 'video_processing') {
            return {
              insert: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest
                .fn()
                .mockResolvedValueOnce({ data: duplicateQueueItem, error: null })
                .mockResolvedValueOnce({ data: duplicateQueueItem, error: null }),
              update: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              delete: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnThis(),
              lt: jest.fn().mockReturnThis(),
              in: jest.fn().mockReturnThis(),
            }
          }
          if (table === 'video_metadata') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: mockMetadata, error: null }),
            }
          }
          return {}
        }),
      })
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
        status: duplicateQueueItem,
      })
    })
  })

  describe('GET /api/videos/process', () => {
    it('should get video status', async () => {
      // Simulate video in queue
      ;(createServerActionSupabaseClient as jest.Mock).mockReturnValueOnce({
        auth: {
          getSession: jest.fn(() =>
            Promise.resolve({ data: { session: { user: { id: mockUserId } } }, error: null })
          ),
        },
        from: jest.fn((table: string) => {
          if (table === 'video_processing') {
            return {
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: mockQueueItem, error: null }),
              eq: jest.fn().mockReturnThis(),
            }
          }
          if (table === 'video_metadata') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: mockMetadata, error: null }),
            }
          }
          return {}
        }),
      })
      const request = new Request('http://localhost/api/videos/process?videoId=' + mockVideoId, {
        method: 'GET',
      })
      const response = await GETWrapper(request)
      expect(response).toBeInstanceOf(NodeFetchResponse)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toEqual({ status: mockQueueItem, metadata: mockMetadata })
    })

    it('should handle non-existent video', async () => {
      // Simulate video not in queue
      ;(createServerActionSupabaseClient as jest.Mock).mockReturnValueOnce({
        auth: {
          getSession: jest.fn(() =>
            Promise.resolve({ data: { session: { user: { id: mockUserId } } }, error: null })
          ),
        },
        from: jest.fn((table: string) => {
          if (table === 'video_processing') {
            return {
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
              eq: jest.fn().mockReturnThis(),
            }
          }
          if (table === 'video_metadata') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            }
          }
          return {}
        }),
      })
      const request = new Request('http://localhost/api/videos/process?videoId=nonexistent', {
        method: 'GET',
      })
      const response = await GETWrapper(request)
      expect(response).toBeInstanceOf(NodeFetchResponse)
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data).toEqual({ error: 'Video not found in queue' })
    })
  })

  describe('DELETE /api/videos/process', () => {
    it('should remove video from queue', async () => {
      // Simulate video in queue
      ;(createServerActionSupabaseClient as jest.Mock).mockReturnValueOnce({
        auth: {
          getSession: jest.fn(() =>
            Promise.resolve({ data: { session: { user: { id: mockUserId } } }, error: null })
          ),
        },
        from: jest.fn((table: string) => {
          if (table === 'video_processing') {
            return {
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: mockQueueItem, error: null }),
              eq: jest.fn().mockReturnThis(),
              delete: jest.fn().mockReturnThis(),
            }
          }
          if (table === 'video_metadata') {
            return {
              delete: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
            }
          }
          return {}
        }),
      })
      const request = new Request('http://localhost/api/videos/process?videoId=' + mockVideoId, {
        method: 'DELETE',
      })
      const response = await DELETEWrapper(request)
      expect(response).toBeInstanceOf(NodeFetchResponse)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toEqual({ message: 'Video removed from queue' })
    })

    it('should handle non-existent video', async () => {
      // Simulate video not in queue
      ;(createServerActionSupabaseClient as jest.Mock).mockReturnValueOnce({
        auth: {
          getSession: jest.fn(() =>
            Promise.resolve({ data: { session: { user: { id: mockUserId } } }, error: null })
          ),
        },
        from: jest.fn((table: string) => {
          if (table === 'video_processing') {
            return {
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
              eq: jest.fn().mockReturnThis(),
              delete: jest.fn().mockReturnThis(),
            }
          }
          if (table === 'video_metadata') {
            return {
              delete: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
            }
          }
          return {}
        }),
      })
      const request = new Request('http://localhost/api/videos/process?videoId=nonexistent', {
        method: 'DELETE',
      })
      const response = await DELETEWrapper(request)
      expect(response).toBeInstanceOf(NodeFetchResponse)
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data).toEqual({ error: 'Video not found in queue' })
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
