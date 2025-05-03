import { GuideGenerator } from '../openai'
import OpenAI from 'openai'
import { GuideConfig } from '../types'

// Mock dependencies
jest.mock('openai')
jest.mock('@/config/logger')

describe('GuideGenerator', () => {
  const mockApiKey = 'test-api-key'
  const mockTranscription = 'Test transcription'
  const mockWords = [
    { text: 'test', start: 0, end: 1 },
    { text: 'words', start: 2, end: 3 }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    let callCount = 0
    ;(OpenAI as unknown as jest.Mock).mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockImplementation(() => {
            callCount++
            if (callCount === 1) {
              // Structure response
              return Promise.resolve({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        title: 'Test Guide',
                        summary: 'Test Summary',
                        sections: [
                          {
                            title: 'Section 1',
                          },
                        ],
                      }),
                    },
                  },
                ],
              })
            } else if (callCount === 2) {
              // Section content response
              return Promise.resolve({
                choices: [
                  {
                    message: {
                      content: 'Section 1 content',
                    },
                  },
                ],
              })
            } else {
              // Keywords response
              return Promise.resolve({
                choices: [
                  {
                    message: {
                      content: 'test, guide',
                    },
                  },
                ],
              })
            }
          }),
        },
      },
    }))
  })

  describe('generateGuide', () => {
    it('should generate a guide from transcription', async () => {
      const generator = new GuideGenerator(mockApiKey)
      const config: GuideConfig = {
        transcription: mockTranscription,
        words: mockWords,
        style: 'default',
        targetAudience: 'intermediate',
        maxLength: undefined,
        includeTimestamps: false
      }

      const guide = await generator.generateGuide(
        config.transcription,
        config.words,
        config
      )

      expect(guide).toEqual({
        title: 'Test Guide',
        summary: 'Test Summary',
        sections: [
          {
            title: 'Section 1',
            content: 'Section 1 content'
          }
        ],
        keywords: ['test', 'guide'],
        difficulty: 'intermediate'
      })
    })

    it('should handle OpenAI error', async () => {
      ;(OpenAI as unknown as jest.Mock).mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('OpenAI error'))
          }
        }
      }))

      const generator = new GuideGenerator(mockApiKey)
      const config: GuideConfig = {
        transcription: mockTranscription,
        words: mockWords,
        style: 'default',
        targetAudience: 'intermediate',
        maxLength: undefined,
        includeTimestamps: false
      }

      await expect(generator.generateGuide(
        config.transcription,
        config.words,
        config
      )).rejects.toThrow('Failed to generate guide')
    })

    it('should handle invalid guide structure', async () => {
      ;(OpenAI as unknown as jest.Mock).mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: 'invalid json'
                  }
                }
              ]
            })
          }
        }
      }))

      const generator = new GuideGenerator(mockApiKey)
      const config: GuideConfig = {
        transcription: mockTranscription,
        words: mockWords,
        style: 'default',
        targetAudience: 'intermediate',
        maxLength: undefined,
        includeTimestamps: false
      }

      await expect(generator.generateGuide(
        config.transcription,
        config.words,
        config
      )).rejects.toThrow('Failed to generate guide')
    })
  })
}) 