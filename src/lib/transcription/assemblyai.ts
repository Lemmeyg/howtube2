import { logger } from '@/config/logger'
import fs from 'fs/promises'
import path from 'path'

export interface TranscriptionConfig {
  language_code?: string
  punctuate?: boolean
  format_text?: boolean
  dual_channel?: boolean
  webhook_url?: string
  boost_native_speaker?: boolean
  filter_profanity?: boolean
  speaker_labels?: boolean
  auto_highlights?: boolean
  content_safety?: boolean
  iab_categories?: boolean
  sentiment_analysis?: boolean
  auto_chapters?: boolean
  entity_detection?: boolean
  summarization?: boolean
}

export interface TranscriptionStatus {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'error'
  text?: string
  words?: Array<{
    text: string
    start: number
    end: number
    confidence: number
    speaker?: string
  }>
  error?: string
  audio_url: string
  acoustic_model: string
  language_model: string
  language_code: string
  audio_duration: number
  created_at: string
  completed_at?: string
}

export interface TranscriptionWord {
  text: string
  start: number
  end: number
  confidence: number
  speaker?: string
}

export interface TranscriptionResult {
  id: string
  text: string
  words: TranscriptionWord[]
  audioDuration: number
  createdAt: string
  completedAt?: string
}

export class AssemblyAI {
  private readonly apiKey: string
  private readonly baseUrl = 'https://api.assemblyai.com/v2'

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('AssemblyAI API key is required')
    }
    this.apiKey = apiKey
  }

  /**
   * Submit audio for transcription
   */
  async submitTranscription(audioPath: string, config: TranscriptionConfig = {}): Promise<string> {
    try {
      // Check if the audio path is a URL or local file
      const isUrl = audioPath.startsWith('http://') || audioPath.startsWith('https://')

      let audioUrl = audioPath
      if (!isUrl) {
        // For local files, use AssemblyAI's direct upload endpoint
        const formData = new FormData()
        const file = await fs.readFile(audioPath)
        formData.append('audio_file', new Blob([file]), path.basename(audioPath))

        const uploadResponse = await fetch(`${this.baseUrl}/upload`, {
          method: 'POST',
          headers: {
            Authorization: this.apiKey,
          },
          body: formData,
        })

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json()
          throw new Error(`Failed to upload audio file: ${error.message}`)
        }

        const uploadData = await uploadResponse.json()
        audioUrl = uploadData.upload_url
      }

      const response = await fetch(`${this.baseUrl}/transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.apiKey,
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          ...config,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Failed to submit transcription: ${error.message}`)
      }

      const data = await response.json()
      return data.id
    } catch (error) {
      logger.error('Error submitting transcription:', error)
      throw new Error('Failed to submit transcription')
    }
  }

  /**
   * Get transcription status and result
   */
  async getTranscriptionStatus(transcriptionId: string): Promise<TranscriptionStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/transcript/${transcriptionId}`, {
        headers: {
          Authorization: this.apiKey,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Failed to get transcription status: ${error.message}`)
      }

      return await response.json()
    } catch (error) {
      logger.error('Error getting transcription status:', error)
      throw new Error('Failed to get transcription status')
    }
  }

  /**
   * Wait for transcription to complete
   */
  async waitForTranscription(
    transcriptionId: string,
    pollingInterval = 2000,
    maxAttempts = 300
  ): Promise<TranscriptionResult> {
    let attempts = 0

    while (attempts < maxAttempts) {
      const status = await this.getTranscriptionStatus(transcriptionId)

      if (status.status === 'completed') {
        return {
          id: status.id,
          text: status.text || '',
          words: status.words || [],
          audioDuration: status.audio_duration,
          createdAt: status.created_at,
          completedAt: status.completed_at,
        }
      }

      if (status.status === 'error') {
        throw new Error(`Transcription failed: ${status.error}`)
      }

      await new Promise(resolve => setTimeout(resolve, pollingInterval))
      attempts++
    }

    throw new Error('Transcription timed out')
  }

  /**
   * Delete a transcription
   */
  async deleteTranscription(transcriptionId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/transcript/${transcriptionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: this.apiKey,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Failed to delete transcription: ${error.message}`)
      }
    } catch (error) {
      logger.error('Error deleting transcription:', error)
      throw new Error('Failed to delete transcription')
    }
  }
}
