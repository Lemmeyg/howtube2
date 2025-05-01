import { AssemblyAI, TranscriptionConfig, TranscriptionStatus } from '../assemblyai'
import { logger } from '@/config/logger'

// Mock fetch
global.fetch = jest.fn()

// Mock logger
jest.mock('@/config/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}))

describe('AssemblyAI', () => {
  const mockApiKey = 'test-api-key'
  const mockAudioUrl = 'https://example.com/audio.mp3'
  const mockTranscriptionId = 'test-transcription-id'

  let assemblyAI: AssemblyAI

  beforeEach(() => {
    jest.clearAllMocks()
    assemblyAI = new AssemblyAI(mockApiKey)
  })

  describe('constructor', () => {
    it('should throw error if API key is not provided', () => {
      expect(() => new AssemblyAI('')).toThrow('AssemblyAI API key is required')
    })
  })

  describe('submitTranscription', () => {
    const mockConfig: TranscriptionConfig = {
      language_code: 'en',
      punctuate: true,
    }

    beforeEach(() => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: mockTranscriptionId }),
      })
    })

    it('should submit audio for transcription', async () => {
      const result = await assemblyAI.submitTranscription(mockAudioUrl, mockConfig)

      expect(result).toBe(mockTranscriptionId)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.assemblyai.com/v2/transcript',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: mockApiKey,
          },
          body: JSON.stringify({
            audio_url: mockAudioUrl,
            ...mockConfig,
          }),
        }
      )
    })

    it('should handle API errors', async () => {
      const errorMessage = 'Invalid audio URL'
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: errorMessage }),
      })

      await expect(assemblyAI.submitTranscription(mockAudioUrl)).rejects.toThrow(
        'Failed to submit transcription'
      )
      expect(logger.error).toHaveBeenCalled()
    })

    it('should handle network errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      await expect(assemblyAI.submitTranscription(mockAudioUrl)).rejects.toThrow(
        'Failed to submit transcription'
      )
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('getTranscriptionStatus', () => {
    const mockStatus: TranscriptionStatus = {
      id: mockTranscriptionId,
      status: 'completed',
      text: 'Test transcription',
      words: [
        {
          text: 'Test',
          start: 0,
          end: 1000,
          confidence: 0.9,
        },
      ],
      audio_url: mockAudioUrl,
      acoustic_model: 'default',
      language_model: 'default',
      language_code: 'en',
      audio_duration: 60,
      created_at: '2024-03-21T00:00:00Z',
      completed_at: '2024-03-21T00:01:00Z',
    }

    beforeEach(() => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      })
    })

    it('should get transcription status', async () => {
      const result = await assemblyAI.getTranscriptionStatus(mockTranscriptionId)

      expect(result).toEqual(mockStatus)
      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.assemblyai.com/v2/transcript/${mockTranscriptionId}`,
        {
          headers: {
            Authorization: mockApiKey,
          },
        }
      )
    })

    it('should handle API errors', async () => {
      const errorMessage = 'Transcription not found'
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: errorMessage }),
      })

      await expect(assemblyAI.getTranscriptionStatus(mockTranscriptionId)).rejects.toThrow(
        'Failed to get transcription status'
      )
      expect(logger.error).toHaveBeenCalled()
    })
  })

  describe('waitForTranscription', () => {
    const mockCompletedStatus: TranscriptionStatus = {
      id: mockTranscriptionId,
      status: 'completed',
      text: 'Test transcription',
      words: [
        {
          text: 'Test',
          start: 0,
          end: 1000,
          confidence: 0.9,
        },
      ],
      audio_url: mockAudioUrl,
      acoustic_model: 'default',
      language_model: 'default',
      language_code: 'en',
      audio_duration: 60,
      created_at: '2024-03-21T00:00:00Z',
      completed_at: '2024-03-21T00:01:00Z',
    }

    it('should wait for transcription to complete', async () => {
      const processingStatus = { ...mockCompletedStatus, status: 'processing' }
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(processingStatus),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCompletedStatus),
        })

      const result = await assemblyAI.waitForTranscription(mockTranscriptionId, 100, 2)

      expect(result).toEqual({
        id: mockCompletedStatus.id,
        text: mockCompletedStatus.text,
        words: mockCompletedStatus.words,
        audioDuration: mockCompletedStatus.audio_duration,
        createdAt: mockCompletedStatus.created_at,
        completedAt: mockCompletedStatus.completed_at,
      })
    })

    it('should handle transcription errors', async () => {
      const errorStatus = {
        ...mockCompletedStatus,
        status: 'error',
        error: 'Processing failed',
      }
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(errorStatus),
      })

      await expect(
        assemblyAI.waitForTranscription(mockTranscriptionId, 100, 1)
      ).rejects.toThrow('Transcription failed: Processing failed')
    })

    it('should handle timeout', async () => {
      const processingStatus = { ...mockCompletedStatus, status: 'processing' }
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(processingStatus),
      })

      await expect(
        assemblyAI.waitForTranscription(mockTranscriptionId, 100, 1)
      ).rejects.toThrow('Transcription timed out')
    })
  })

  describe('deleteTranscription', () => {
    beforeEach(() => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })
    })

    it('should delete transcription', async () => {
      await assemblyAI.deleteTranscription(mockTranscriptionId)

      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.assemblyai.com/v2/transcript/${mockTranscriptionId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: mockApiKey,
          },
        }
      )
    })

    it('should handle API errors', async () => {
      const errorMessage = 'Transcription not found'
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: errorMessage }),
      })

      await expect(assemblyAI.deleteTranscription(mockTranscriptionId)).rejects.toThrow(
        'Failed to delete transcription'
      )
      expect(logger.error).toHaveBeenCalled()
    })
  })
}) 