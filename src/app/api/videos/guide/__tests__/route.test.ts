import { createServerClient } from '@/lib/supabase/server'
import { GuideGenerator } from '@/lib/guide/openai'
import { GuideStorage } from '@/lib/guide/storage'
import { POST, GET, DELETE } from '../route'

// Mock dependencies
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
}))

jest.mock('@/lib/supabase/server')
jest.mock('@/lib/guide/openai')
jest.mock('@/lib/guide/storage')

describe('Guide API Route', () => {
  const mockUserId = 'test-user-id'
  const mockVideoId = 'test-video-id'
  const mockGuideId = 'test-guide-id'

  const mockSession = {
    user: {
      id: mockUserId,
    },
  }

  const mockTranscription = {
    video_id: mockVideoId,
    status: 'completed',
    text: 'Test transcription',
    words: [{ text: 'Test', start: 0, end: 1000 }],
  }

  const mockGuide = {
    title: 'Test Guide',
    summary: 'A test guide',
    sections: [
      {
        title: 'Section 1',
        content: 'Content 1',
      },
    ],
    keywords: ['test'],
    difficulty: 'intermediate',
  }

  const mockSupabase = {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: mockSession } })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: mockTranscription, error: null })),
        })),
      })),
    })),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createServerClient as jest.Mock).mockReturnValue(mockSupabase)
    ;(GuideGenerator.prototype.generateGuide as jest.Mock).mockResolvedValue(mockGuide)
    ;(GuideStorage.prototype.createGuide as jest.Mock).mockResolvedValue({ id: mockGuideId })
  })

  describe('POST /api/videos/guide', () => {
    it('should generate guide from transcription', async () => {
      const request = new Request('http://localhost/api/videos/guide', {
        method: 'POST',
        body: JSON.stringify({
          videoId: mockVideoId,
          config: {
            style: 'detailed',
            targetAudience: 'intermediate',
          },
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        message: 'Guide generated successfully',
        guideId: mockGuideId,
      })

      // Verify guide generation
      expect(GuideGenerator.prototype.generateGuide).toHaveBeenCalledWith(
        mockTranscription.text,
        mockTranscription.words,
        expect.any(Object)
      )

      // Verify guide storage
      expect(GuideStorage.prototype.createGuide).toHaveBeenCalledWith(mockVideoId, mockUserId)
      expect(GuideStorage.prototype.updateGuide).toHaveBeenCalledWith(mockGuideId, mockGuide)
    })

    it('should handle missing video ID', async () => {
      const request = new Request('http://localhost/api/videos/guide', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('should handle missing transcription', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              error: { code: 'PGRST116' },
            })),
          })),
        })),
      }))

      const request = new Request('http://localhost/api/videos/guide', {
        method: 'POST',
        body: JSON.stringify({ videoId: mockVideoId }),
      })

      const response = await POST(request)
      expect(response.status).toBe(404)
    })

    it('should handle incomplete transcription', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: { ...mockTranscription, status: 'processing' },
              error: null,
            })),
          })),
        })),
      }))

      const request = new Request('http://localhost/api/videos/guide', {
        method: 'POST',
        body: JSON.stringify({ videoId: mockVideoId }),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('should handle guide generation errors', async () => {
      const mockError = new Error('Generation failed')
      ;(GuideGenerator.prototype.generateGuide as jest.Mock).mockRejectedValue(mockError)

      const request = new Request('http://localhost/api/videos/guide', {
        method: 'POST',
        body: JSON.stringify({ videoId: mockVideoId }),
      })

      const response = await POST(request)
      expect(response.status).toBe(500)

      expect(GuideStorage.prototype.markGuideError).toHaveBeenCalledWith(
        mockGuideId,
        'Generation failed'
      )
    })
  })

  describe('GET /api/videos/guide', () => {
    const mockGuideMetadata = {
      id: mockGuideId,
      videoId: mockVideoId,
      title: mockGuide.title,
      summary: mockGuide.summary,
      keywords: mockGuide.keywords,
      difficulty: mockGuide.difficulty,
      status: 'completed',
      userId: mockUserId,
      createdAt: '2024-03-23T00:00:00Z',
      updatedAt: '2024-03-23T00:00:00Z',
    }

    const mockGuideContent = {
      guideId: mockGuideId,
      sections: mockGuide.sections,
    }

    beforeEach(() => {
      ;(GuideStorage.prototype.getGuideMetadata as jest.Mock).mockResolvedValue(mockGuideMetadata)
      ;(GuideStorage.prototype.getGuideContent as jest.Mock).mockResolvedValue(mockGuideContent)
      ;(GuideStorage.prototype.listGuides as jest.Mock).mockResolvedValue([mockGuideMetadata])
    })

    it('should get specific guide', async () => {
      const request = new Request(`http://localhost/api/videos/guide?guideId=${mockGuideId}`, {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        ...mockGuideMetadata,
        sections: mockGuideContent.sections,
      })
    })

    it('should list guides for video', async () => {
      const request = new Request(`http://localhost/api/videos/guide?videoId=${mockVideoId}`, {
        method: 'GET',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual([mockGuideMetadata])
      expect(GuideStorage.prototype.listGuides).toHaveBeenCalledWith(mockUserId, mockVideoId)
    })

    it('should handle missing parameters', async () => {
      const request = new Request('http://localhost/api/videos/guide', {
        method: 'GET',
      })

      const response = await GET(request)
      expect(response.status).toBe(400)
    })
  })

  describe('DELETE /api/videos/guide', () => {
    const mockGuideMetadata = {
      id: mockGuideId,
      videoId: mockVideoId,
      userId: mockUserId,
    }

    beforeEach(() => {
      ;(GuideStorage.prototype.getGuideMetadata as jest.Mock).mockResolvedValue(mockGuideMetadata)
    })

    it('should delete guide', async () => {
      const request = new Request(`http://localhost/api/videos/guide?guideId=${mockGuideId}`, {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        message: 'Guide deleted successfully',
      })

      expect(GuideStorage.prototype.deleteGuide).toHaveBeenCalledWith(mockGuideId)
    })

    it('should handle unauthorized deletion', async () => {
      ;(GuideStorage.prototype.getGuideMetadata as jest.Mock).mockResolvedValue({
        ...mockGuideMetadata,
        userId: 'other-user-id',
      })

      const request = new Request(`http://localhost/api/videos/guide?guideId=${mockGuideId}`, {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      expect(response.status).toBe(403)
    })

    it('should handle missing guide ID', async () => {
      const request = new Request('http://localhost/api/videos/guide', {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      expect(response.status).toBe(400)
    })
  })
})
