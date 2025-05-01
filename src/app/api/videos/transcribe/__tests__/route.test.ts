import { createServerClient } from '@/lib/supabase/server'
import { AssemblyAI } from '@/lib/transcription/assemblyai'
import { extractAudio } from '@/lib/transcription/audio'
import { VideoStorage } from '@/lib/video/storage'
import { POST, GET } from '../route'

// Mock dependencies
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
}))

jest.mock('@/lib/supabase/server')
jest.mock('@/lib/transcription/assemblyai')
jest.mock('@/lib/transcription/audio')
jest.mock('@/lib/video/storage')

describe('Transcription API Route', () => {
  const mockUserId = 'test-user-id'
  const mockVideoId = 'test-video-id'
  const mockTranscriptionId = 'test-transcription-id'
  const mockAudioPath = '/path/to/audio.mp3'
  const mockAudioUrl = 'https://storage.example.com/audio.mp3'

  const mockSession = {
    user: {
      id: mockUserId,
    },
  }

  const mockTranscription = {
    id: 'test-uuid',
    video_id: mockVideoId,
    transcription_id: mockTranscriptionId,
    status: 'processing',
    user_id: mockUserId,
    created_at: new Date().toISOString(),
  }

  const mockSupabase = {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: mockSession } })),
    },
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ error: null })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: mockTranscription, error: null })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null })),
      })),
    })),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(extractAudio as jest.Mock).mockResolvedValue(mockAudioPath)
    ;(VideoStorage.uploadAudio as jest.Mock).mockResolvedValue(mockAudioUrl)
    ;(AssemblyAI.prototype.submitTranscription as jest.Mock).mockResolvedValue(mockTranscriptionId)
  })

  describe('POST /api/videos/transcribe', () => {
    it('should start video transcription', async () => {
      const request = new Request('http://localhost/api/videos/transcribe', {
        method: 'POST',
        body: JSON.stringify({ videoId: mockVideoId }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        message: 'Transcription started',
        transcriptionId: mockTranscriptionId,
      })

      // Verify audio extraction and upload
      expect(extractAudio).toHaveBeenCalledWith(mockVideoId)
      expect(VideoStorage.uploadAudio).toHaveBeenCalledWith(mockVideoId, mockAudioPath)

      // Verify transcription submission
      expect(AssemblyAI.prototype.submitTranscription).toHaveBeenCalledWith(
        mockAudioUrl,
        expect.objectContaining({
          language_code: 'en',
          punctuate: true,
        })
      )

      // Verify database insertion
      expect(mockSupabase.from).toHaveBeenCalledWith('video_transcriptions')
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        video_id: mockVideoId,
        transcription_id: mockTranscriptionId,
        status: 'processing',
        user_id: mockUserId,
      })

      // Verify cleanup
      expect(VideoStorage.deleteAudio).toHaveBeenCalledWith(mockVideoId)
    })

    it('should handle missing video ID', async () => {
      const request = new Request('http://localhost/api/videos/transcribe', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('should handle unauthorized requests', async () => {
      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
      })

      const request = new Request('http://localhost/api/videos/transcribe', {
        method: 'POST',
        body: JSON.stringify({ videoId: mockVideoId }),
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/videos/transcribe', () => {
    it('should get transcription status', async () => {
      const request = new Request(`http://localhost/api/videos/transcribe?videoId=${mockVideoId}`, {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockTranscription)
    })

    it('should handle missing video ID', async () => {
      const request = new Request('http://localhost/api/videos/transcribe', {
        method: 'GET',
      })

      const response = await GET(request)
      expect(response.status).toBe(400)
    })

    it('should handle non-existent transcription', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: null,
              error: { code: 'PGRST116' },
            })),
          })),
        })),
      }))

      const request = new Request(`http://localhost/api/videos/transcribe?videoId=${mockVideoId}`, {
        method: 'GET',
      })

      const response = await GET(request)
      expect(response.status).toBe(404)
    })

    it('should update completed transcription', async () => {
      const mockCompletedStatus = {
        status: 'completed',
        text: 'Test transcription',
        words: [{ text: 'test', start: 0, end: 1000 }],
        completed_at: new Date().toISOString(),
      }

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: { ...mockTranscription, status: 'processing' },
              error: null,
            })),
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({ error: null })),
        })),
      }))
      ;(AssemblyAI.prototype.getTranscriptionStatus as jest.Mock).mockResolvedValue(
        mockCompletedStatus
      )

      const request = new Request(`http://localhost/api/videos/transcribe?videoId=${mockVideoId}`, {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('completed')
      expect(data.text).toBe(mockCompletedStatus.text)
      expect(data.words).toEqual(mockCompletedStatus.words)
    })
  })
})
