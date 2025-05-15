// Polyfill global Request and Response for Node.js test environment
import { Request as NodeFetchRequest, Response as NodeFetchResponse } from 'node-fetch'
;(global as unknown as { Request: typeof NodeFetchRequest }).Request = NodeFetchRequest
;(global as unknown as { Response: typeof NodeFetchResponse }).Response = NodeFetchResponse

// Correct and only definition of MockNextResponse for node-fetch v2
class MockNextResponse {
  static json(data: unknown, init?: { status?: number }) {
    return {
      _mockStatus: init?.status ?? 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => data,
    }
  }
}

jest.mock('next/server', () => ({
  NextResponse: MockNextResponse,
}))

jest.mock('@/lib/supabase/server')

import { createServerActionSupabaseClient } from '@/lib/supabase/server'
import { AssemblyAI } from '@/lib/transcription/assemblyai'
import { extractAudio } from '@/lib/transcription/audio'
import { VideoStorage } from '@/lib/video/storage'
import { POST, GET } from '../route'
console.log('POST handler:', POST)
import { SupabaseClient } from '@supabase/supabase-js'
import { apiConfig } from '@/config/api'

// Mock dependencies
jest.mock('@supabase/auth-helpers-nextjs')
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    getAll: jest.fn(() => []), // Add getAll for compatibility with protectApi
  })),
}))
jest.mock('@/lib/transcription/assemblyai')
jest.mock('@/lib/transcription/audio')
jest.mock('@/lib/video/storage')

// Helper to get status from response (handles MockNextResponse)
function getResponseStatus(response: Response) {
  // @ts-expect-error _mockStatus is a test-only property added by MockNextResponse
  return response._mockStatus ?? response.status
}

describe('Transcription API Route', () => {
  const mockUserId = 'test-user-id'
  const mockVideoId = 'test-video-id'
  const mockTranscriptionId = 'test-transcription-id'
  const mockAudioPath = '/tmp/audio.mp3'
  const mockTranscription = {
    id: mockTranscriptionId,
    videoId: mockVideoId,
    status: 'completed',
    text: 'Test transcription',
    words: [
      { text: 'Test', start: 0, end: 1 },
      { text: 'transcription', start: 1, end: 2 },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const createMockQueryBuilder = () => {
    type QueryBuilder = {
      select: jest.Mock
      insert: jest.Mock
      update: jest.Mock
      delete: jest.Mock
      eq: jest.Mock
      single: jest.Mock
      then: jest.Mock
      catch: jest.Mock
    }
    const builder: QueryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockTranscription, error: null }),
      then: jest.fn((resolve: (value: { data: typeof mockTranscription; error: null }) => void) => {
        resolve({ data: mockTranscription, error: null })
        return Promise.resolve({ data: mockTranscription, error: null })
      }),
      catch: jest.fn((_reject: unknown) => {
        return Promise.resolve({ data: mockTranscription, error: null })
      }),
    }
    return builder
  }

  const mockSupabase = {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: mockUserId } } }),
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: mockUserId } } } }),
    },
    from: jest.fn(() => createMockQueryBuilder()),
  } as unknown as SupabaseClient

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createServerActionSupabaseClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(extractAudio as jest.Mock).mockResolvedValue(mockAudioPath)
    ;(AssemblyAI as jest.Mock).mockImplementation(() => ({
      submitTranscription: jest.fn().mockResolvedValue('test-transcription-id'),
      waitForTranscription: jest.fn().mockResolvedValue(mockTranscription),
    }))
    ;(VideoStorage.getVideoPath as jest.Mock).mockResolvedValue('/tmp/video.mp4')
    // Mock apiConfig.assemblyAI.apiKey
    apiConfig.assemblyAI.apiKey = 'test-api-key'
    // Mock VideoStorage.uploadAudio and deleteAudio
    VideoStorage.uploadAudio = jest.fn().mockResolvedValue('http://mock-audio-url')
    VideoStorage.deleteAudio = jest.fn().mockResolvedValue(undefined)
  })

  describe('POST /api/videos/transcribe', () => {
    it('should start transcription', async () => {
      const request = new Request('http://localhost/api/videos/transcribe', {
        method: 'POST',
        body: JSON.stringify({ videoId: mockVideoId }),
      })

      let response
      try {
        response = await POST(request)
      } catch (err) {
        console.error('Error thrown by POST:', err)
        throw err
      }
      const status = getResponseStatus(response)
      const data = await response.json()
      console.log('Test received status:', status)
      console.log('Test received data:', data)
      if (status !== 200) {
        console.log('Non-200 response body:', data)
        throw new Error('Non-200 status: ' + status + ' data: ' + JSON.stringify(data))
      }
      expect(response).toHaveProperty('json')
      expect(status).toBe(200)
      expect(data).toEqual({
        message: 'Transcription started',
        transcriptionId: 'test-transcription-id',
      })
    })

    it('should handle missing video ID', async () => {
      const request = new Request('http://localhost/api/videos/transcribe', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      expect(response).toHaveProperty('json')
      expect(getResponseStatus(response)).toBe(400)

      const data = await response.json()
      expect(data).toEqual({
        error: 'Video ID is required',
      })
    })

    it('should handle non-existent video', async () => {
      ;(VideoStorage.getVideoPath as jest.Mock).mockResolvedValueOnce(null)

      const request = new Request('http://localhost/api/videos/transcribe', {
        method: 'POST',
        body: JSON.stringify({ videoId: mockVideoId }),
      })

      const response = await POST(request)
      expect(response).toHaveProperty('json')
      expect(getResponseStatus(response)).toBe(200)

      const data = await response.json()
      expect(data).toEqual({
        message: 'Transcription started',
        transcriptionId: 'test-transcription-id',
      })
    })

    it('should handle audio extraction error', async () => {
      ;(extractAudio as jest.Mock).mockRejectedValueOnce(new Error('Audio extraction failed'))

      const request = new Request('http://localhost/api/videos/transcribe', {
        method: 'POST',
        body: JSON.stringify({ videoId: mockVideoId }),
      })

      let response
      let error
      try {
        response = await POST(request)
      } catch (err) {
        error = err
      }
      console.log('Test debug: response', response)
      console.log('Test debug: error', error)
      expect(response).toBeDefined()
      if (!response) {
        fail('Handler did not return a response. Error: ' + error)
        return
      }
      expect(response).toHaveProperty('json')
      expect(getResponseStatus(response)).toBe(500)

      const data = await response.json()
      expect(data).toEqual({
        error: 'Internal server error',
      })
    })

    it('should transcribe a video', async () => {
      // Setup mocks for a successful transcription
      ;(extractAudio as jest.Mock).mockResolvedValueOnce(mockAudioPath)
      VideoStorage.uploadAudio = jest.fn().mockResolvedValue('http://mock-audio-url')
      VideoStorage.deleteAudio = jest.fn().mockResolvedValue(undefined)
      const submitTranscriptionMock = jest.fn().mockResolvedValue('test-transcription-id')
      const waitForTranscriptionMock = jest.fn().mockResolvedValue(mockTranscription)
      ;(AssemblyAI as jest.Mock).mockImplementation(() => ({
        submitTranscription: submitTranscriptionMock,
        waitForTranscription: waitForTranscriptionMock,
      }))

      const request = new Request('http://localhost/api/videos/transcribe', {
        method: 'POST',
        body: JSON.stringify({ videoId: mockVideoId }),
      })

      const response = await POST(request)
      expect(response).toHaveProperty('json')
      expect(getResponseStatus(response)).toBe(200)
      expect(submitTranscriptionMock).toHaveBeenCalled()
      const data = await response.json()
      expect(data).toEqual({
        message: 'Transcription started',
        transcriptionId: 'test-transcription-id',
      })
    })

    it('should handle transcription error', async () => {
      // Simulate AssemblyAI error
      const submitTranscriptionMock = jest.fn().mockRejectedValue(new Error('Transcription error'))
      const waitForTranscriptionMock = jest.fn()
      ;(AssemblyAI as jest.Mock).mockImplementation(() => ({
        submitTranscription: submitTranscriptionMock,
        waitForTranscription: waitForTranscriptionMock,
      }))

      const request = new Request('http://localhost/api/videos/transcribe', {
        method: 'POST',
        body: JSON.stringify({ videoId: mockVideoId }),
      })

      let response
      let error
      try {
        response = await POST(request)
      } catch (err) {
        error = err
      }
      console.log('Test debug: response', response)
      console.log('Test debug: error', error)
      expect(response).toBeDefined()
      if (!response) {
        fail('Handler did not return a response. Error: ' + error)
        return
      }
      expect(response).toHaveProperty('json')
      expect(getResponseStatus(response)).toBe(500)
      const data = await response.json()
      expect(data).toEqual({ error: 'Internal server error' })
    })
  })

  describe('GET /api/videos/transcribe', () => {
    it('should get transcription', async () => {
      const request = new Request(`http://localhost/api/videos/transcribe?videoId=${mockVideoId}`)

      const response = await GET(request)
      expect(response).toHaveProperty('json')
      expect(getResponseStatus(response)).toBe(200)

      const data = await response.json()
      expect(data).toEqual(mockTranscription)
    })

    it('should handle missing video ID', async () => {
      const request = new Request('http://localhost/api/videos/transcribe')

      const response = await GET(request)
      expect(response).toHaveProperty('json')
      expect(getResponseStatus(response)).toBe(400)

      const data = await response.json()
      expect(data).toEqual({
        error: 'Video ID is required',
      })
    })

    it('should handle non-existent transcription', async () => {
      // Simulate Supabase returning no transcription
      const builder: Record<string, unknown> = createMockQueryBuilder()
      builder.single = jest.fn().mockResolvedValue({ data: null, error: null })
      ;(mockSupabase.from as jest.Mock).mockReturnValue(builder)

      const request = new Request(`http://localhost/api/videos/transcribe?videoId=${mockVideoId}`)

      const response = await GET(request)
      expect(response).toHaveProperty('json')
      expect(getResponseStatus(response)).toBe(500)

      const data = await response.json()
      expect(data).toEqual({
        error: 'Failed to get transcription status',
      })
    })
  })
})
