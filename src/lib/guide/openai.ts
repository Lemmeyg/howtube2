import OpenAI from 'openai'
import { logger } from '@/config/logger'
import { apiConfig } from '@/config/api'
import { GuideConfig } from './types'

export interface GuideSection {
  title: string
  content: string
  timestamp?: {
    start: number
    end: number
  }
}

export interface Guide {
  title: string
  summary: string
  sections: GuideSection[]
  keywords: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

export class GuideGenerator {
  private openai: OpenAI

  constructor(apiKey?: string) {
    if (!apiKey && !apiConfig.openAI.apiKey) {
      throw new Error('OpenAI API key is required')
    }
    this.openai = new OpenAI({
      apiKey: apiKey || apiConfig.openAI.apiKey,
    })
  }

  async generateGuide(
    transcriptionOrConfig: string | GuideConfig,
    wordsArg?: Array<{ text: string; start: number; end: number }>,
    configArg?: GuideConfig
  ): Promise<Guide> {
    let transcription: string
    let words: Array<{ text: string; start: number; end: number }>
    let config: GuideConfig

    if (typeof transcriptionOrConfig === 'string') {
      if (!wordsArg || !configArg) {
        throw new Error('transcription, words, and config are required when using the three-argument form')
      }
      transcription = transcriptionOrConfig
      words = wordsArg
      config = configArg
    } else {
      // If called with a single GuideConfig argument
      transcription = transcriptionOrConfig.transcription
      words = transcriptionOrConfig.words
      config = transcriptionOrConfig
    }

    try {
      // Prepare system message based on config
      const style = config.style || 'detailed'
      const targetAudience = config.targetAudience || 'intermediate'
      const maxLength = config.maxLength || 2000

      const systemMessage = `You are an expert content writer specializing in creating educational guides from video transcripts.
Your task is to create a well-structured ${style} guide for ${targetAudience}-level audience.
The guide should be informative, engaging, and easy to follow.
Keep the total content within ${maxLength} characters.
${config.includeTimestamps ? 'Include relevant timestamps for each section.' : ''}
Focus on extracting key concepts, steps, and insights from the transcript.`

      // Generate initial guide structure
      const structureResponse = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: systemMessage,
          },
          {
            role: 'user',
            content: `Please analyze this transcript and create a guide structure with a title and sections:
${transcription}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      })

      const structure = JSON.parse(structureResponse.choices[0].message.content || '{}')

      // Generate detailed content for each section
      const sections: GuideSection[] = []
      for (const section of structure.sections) {
        const sectionResponse = await this.openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: `${systemMessage}
Focus on creating detailed content for this section: "${section.title}"`,
            },
            {
              role: 'user',
              content: transcription,
            },
          ],
          temperature: 0.7,
        })

        const content = sectionResponse.choices[0].message.content || ''

        // Find relevant timestamps if enabled
        let timestamp
        if (config.includeTimestamps) {
          const keywords = content
            .split(/[.,!?]/)
            .flatMap(sentence => sentence.split(' '))
            .filter(word => word.length > 4)
            .map(word => word.toLowerCase())

          const relevantWords = words.filter(w =>
            keywords.some(k => w.text.toLowerCase().includes(k))
          )

          if (relevantWords.length > 0) {
            timestamp = {
              start: relevantWords[0].start,
              end: relevantWords[relevantWords.length - 1].end,
            }
          }
        }

        sections.push({
          title: section.title,
          content,
          ...(timestamp && { timestamp }),
        })
      }

      // Generate keywords
      const keywordsResponse = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'Extract 5-10 relevant keywords or key phrases from the transcript.',
          },
          {
            role: 'user',
            content: transcription,
          },
        ],
        temperature: 0.5,
      })

      const keywords = keywordsResponse.choices[0].message.content
        ?.split(/[,\n]/)
        .map(k => k.trim())
        .filter(k => k.length > 0) || []

      return {
        title: structure.title,
        summary: structure.summary,
        sections,
        keywords,
        difficulty: targetAudience,
      }
    } catch (error) {
      logger.error('Error generating guide:', error)
      throw new Error('Failed to generate guide')
    }
  }
} 