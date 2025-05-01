import OpenAI from 'openai'
import { GuideGenerator, GuideConfig } from '../openai'
import { logger } from '@/config/logger'

// Mock dependencies
jest.mock('openai')
jest.mock('@/config/logger')

describe('GuideGenerator', () => {
  const mockApiKey = 'test-api-key'
  const mockTranscription = 'This is a test transcription about a technical topic.'
  const mockWords = [
    { text: 'This', start: 0, end: 500 },
    { text: 'technical', start: 1000, end: 1500 },
    { text: 'topic', start: 1500, end: 2000 },
  ]

  const mockStructureResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            title: 'Test Guide',
            summary: 'A guide about a technical topic',
            sections: [
              { title: 'Introduction' },
              { title: 'Technical Details' },
            ],
          }),
        },
      },
    ],
  }

  const mockSectionResponse = {
    choices: [
      {
        message: {
          content: 'This is the content for a section.',
        },
      },
    ],
  }

  const mockKeywordsResponse = {
    choices: [
      {
        message: {
          content: 'technical, topic, test',
        },
      },
    ],
  }

  let guideGenerator: GuideGenerator

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock OpenAI chat completions
    ;(OpenAI as jest.Mock).mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
            .mockResolvedValueOnce(mockStructureResponse)
            .mockResolvedValueOnce(mockSectionResponse)
            .mockResolvedValueOnce(mockSectionResponse)
            .mockResolvedValueOnce(mockKeywordsResponse),
        },
      },
    }))

    guideGenerator = new GuideGenerator(mockApiKey)
  })

  describe('constructor', () => {
    it('should throw error if API key is not provided', () => {
      expect(() => new GuideGenerator('')).toThrow('OpenAI API key is required')
    })

    it('should initialize with API key', () => {
      expect(() => new GuideGenerator(mockApiKey)).not.toThrow()
      expect(OpenAI).toHaveBeenCalledWith({ apiKey: mockApiKey })
    })
  })

  describe('generateGuide', () => {
    it('should generate guide with default config', async () => {
      const guide = await guideGenerator.generateGuide(mockTranscription, mockWords)

      expect(guide).toEqual({
        title: 'Test Guide',
        summary: 'A guide about a technical topic',
        sections: [
          {
            title: 'Introduction',
            content: 'This is the content for a section.',
          },
          {
            title: 'Technical Details',
            content: 'This is the content for a section.',
          },
        ],
        keywords: ['technical', 'topic', 'test'],
        difficulty: 'intermediate',
      })

      // Verify OpenAI calls
      const openaiInstance = (OpenAI as jest.Mock).mock.results[0].value
      const createCompletion = openaiInstance.chat.completions.create

      // Check structure generation call
      expect(createCompletion).toHaveBeenNthCalledWith(1, expect.objectContaining({
        model: 'gpt-4-turbo-preview',
        response_format: { type: 'json_object' },
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('detailed guide for intermediate-level audience'),
          }),
        ]),
      }))

      // Check section content generation calls
      expect(createCompletion).toHaveBeenNthCalledWith(2, expect.objectContaining({
        model: 'gpt-4-turbo-preview',
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Introduction'),
          }),
        ]),
      }))

      expect(createCompletion).toHaveBeenNthCalledWith(3, expect.objectContaining({
        model: 'gpt-4-turbo-preview',
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Technical Details'),
          }),
        ]),
      }))
    })

    it('should include timestamps when configured', async () => {
      const config: GuideConfig = {
        includeTimestamps: true,
      }

      const guide = await guideGenerator.generateGuide(mockTranscription, mockWords, config)

      expect(guide.sections[0]).toHaveProperty('timestamp')
      expect(guide.sections[0].timestamp).toEqual({
        start: expect.any(Number),
        end: expect.any(Number),
      })
    })

    it('should handle OpenAI API errors', async () => {
      const mockError = new Error('API error')
      ;(OpenAI as jest.Mock).mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(mockError),
          },
        },
      }))

      await expect(guideGenerator.generateGuide(mockTranscription, mockWords))
        .rejects.toThrow('Failed to generate guide')

      expect(logger.error).toHaveBeenCalledWith('Error generating guide:', mockError)
    })

    it('should respect maxLength configuration', async () => {
      const config: GuideConfig = {
        maxLength: 1000,
      }

      await guideGenerator.generateGuide(mockTranscription, mockWords, config)

      const openaiInstance = (OpenAI as jest.Mock).mock.results[0].value
      const createCompletion = openaiInstance.chat.completions.create

      expect(createCompletion).toHaveBeenNthCalledWith(1, expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('1000 characters'),
          }),
        ]),
      }))
    })

    it('should adapt to different style and audience configurations', async () => {
      const config: GuideConfig = {
        style: 'tutorial',
        targetAudience: 'beginner',
      }

      await guideGenerator.generateGuide(mockTranscription, mockWords, config)

      const openaiInstance = (OpenAI as jest.Mock).mock.results[0].value
      const createCompletion = openaiInstance.chat.completions.create

      expect(createCompletion).toHaveBeenNthCalledWith(1, expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('tutorial guide for beginner-level audience'),
          }),
        ]),
      }))
    })
  })
}) 