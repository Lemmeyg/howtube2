import { SupabaseClient } from '@supabase/supabase-js'
import { Guide } from './openai'
import { GuideMetadata } from './types'
import { logger } from '@/config/logger'

export interface GuideContent {
  guideId: string
  sections: Array<{
    title: string
    content: string
    timestamp?: {
      start: number
      end: number
    }
  }>
}

const allowedDifficulties = ['beginner', 'intermediate', 'advanced'] as const
type Difficulty = (typeof allowedDifficulties)[number]
function toDifficulty(value: string): Difficulty {
  return allowedDifficulties.includes(value as Difficulty) ? (value as Difficulty) : 'beginner'
}

export class GuideStorage {
  constructor(private supabase: SupabaseClient) {}

  async createGuide(videoId: string, userId: string): Promise<{ id: string }> {
    try {
      logger.info('Creating guide for video:', { videoId, userId })
      
      // First verify the video processing record exists
      logger.info('Verifying video processing record...')
      const { data: processing, error: procError } = await this.supabase
        .from('video_processing')
        .select('*')  // Select all columns to see the full record
        .eq('video_id', videoId)
        .single()

      if (procError) {
        logger.error('Failed to verify video processing record:', { 
          error: procError,
          errorMessage: procError.message,
          errorDetails: procError.details,
          errorHint: procError.hint,
          errorCode: procError.code,
          videoId 
        })
        throw new Error(`Failed to verify video processing record: ${procError.message}`)
      }

      if (!processing) {
        logger.error('Video processing record not found:', { videoId })
        throw new Error('Video processing record not found')
      }

      logger.info('Video processing record found:', { 
        processingId: processing.id,
        videoId: processing.video_id,
        status: processing.status,
        url: processing.url
      })

      // Create the guide record
      logger.info('Creating guide record in guides table...', {
        insertData: {
          video_id: videoId,
          user_id: userId,
          status: 'generating'
        }
      })

      try {
        const { data, error } = await this.supabase
          .from('guides')
          .insert({
            video_id: videoId,
            user_id: userId,
            status: 'generating',
          })
          .select('id')
          .single()

        if (error) {
          logger.error('Failed to create guide record:', { 
            error, 
            errorMessage: error.message,
            errorDetails: error.details,
            errorHint: error.hint,
            errorCode: error.code,
            videoId,
            userId
          })
          throw new Error(`Failed to create guide record: ${error.message || 'Unknown error'}`)
        }

        if (!data) {
          logger.error('No data returned after guide creation:', { videoId, userId })
          throw new Error('No data returned after guide creation')
        }

        logger.info('Successfully created guide:', { guideId: data.id })
        return { id: data.id }
      } catch (insertError) {
        logger.error('Exception during guide creation:', {
          error: insertError,
          errorMessage: insertError instanceof Error ? insertError.message : 'Unknown error',
          videoId,
          userId
        })
        throw new Error(`Exception during guide creation: ${insertError instanceof Error ? insertError.message : 'Unknown error'}`)
      }
    } catch (error) {
      logger.error('Error creating guide:', { 
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        videoId,
        userId
      })
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to create guide')
    }
  }

  async updateGuide(guideId: string, guide: Guide): Promise<void> {
    try {
      // Update the guide metadata
      const { error: guideError } = await this.supabase
        .from('guides')
        .update({
          title: guide.title,
          summary: guide.summary,
          keywords: guide.keywords,
          difficulty: guide.difficulty,
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', guideId)

      if (guideError) {
        logger.error('Error updating guide metadata:', guideError)
        throw guideError
      }

      // Remove existing sections for this guide
      const { error: deleteError } = await this.supabase
        .from('guide_sections')
        .delete()
        .eq('guide_id', guideId)

      if (deleteError) {
        logger.error('Error deleting old guide sections:', deleteError)
        throw deleteError
      }

      // Insert new sections
      const sectionsToInsert = guide.sections.map((section, idx) => ({
        guide_id: guideId,
        title: section.title,
        content: section.content,
        section_order: idx,
        timestamp: section.timestamp ? section.timestamp : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))

      if (sectionsToInsert.length > 0) {
        const { error: insertError } = await this.supabase
          .from('guide_sections')
          .insert(sectionsToInsert)

        if (insertError) {
          logger.error('Error inserting new guide sections:', insertError)
          throw insertError
        }
      }
    } catch (error) {
      logger.error('Error updating guide:', error)
      throw new Error('Failed to update guide')
    }
  }

  async markGuideError(guideId: string, error: string): Promise<void> {
    try {
      const { error: dbError } = await this.supabase
        .from('guides')
        .update({
          status: 'error',
          error,
        })
        .eq('id', guideId)

      if (dbError) throw dbError
    } catch (error) {
      logger.error('Error marking guide as failed:', error)
      throw new Error('Failed to update guide status')
    }
  }

  async getGuideMetadata(guideId: string): Promise<GuideMetadata> {
    try {
      const { data, error } = await this.supabase
        .from('guides')
        .select('*')
        .eq('id', guideId)
        .single()

      if (error) throw error
      if (!data) throw new Error('Guide not found')

      return {
        id: data.id,
        videoId: data.video_id,
        title: data.title,
        summary: data.summary,
        keywords: data.keywords,
        difficulty: toDifficulty(data.difficulty),
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        userId: data.user_id,
      }
    } catch (error) {
      logger.error('Error getting guide metadata:', error)
      throw new Error('Failed to get guide metadata')
    }
  }

  async getGuideContent(guideId: string): Promise<GuideContent> {
    try {
      const { data, error } = await this.supabase
        .from('guide_sections')
        .select('*')
        .eq('guide_id', guideId)
        .order('section_order', { ascending: true })

      if (error) throw error

      return {
        guideId,
        sections: data.map(section => ({
          title: section.title,
          content: section.content,
          ...(section.timestamp && {
            timestamp: {
              start: section.timestamp.start,
              end: section.timestamp.end,
            },
          }),
        })),
      }
    } catch (error) {
      logger.error('Error getting guide content:', error)
      throw new Error('Failed to get guide content')
    }
  }

  async deleteGuide(guideId: string): Promise<void> {
    try {
      const { error } = await this.supabase.from('guides').delete().eq('id', guideId)

      if (error) throw error
    } catch (error) {
      logger.error('Error deleting guide:', error)
      throw new Error('Failed to delete guide')
    }
  }

  async listGuides(userId: string, videoId?: string): Promise<GuideMetadata[]> {
    try {
      let query = this.supabase.from('guides').select('*').eq('user_id', userId)

      if (videoId) {
        query = query.eq('video_id', videoId)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      return data.map(guide => ({
        id: guide.id,
        videoId: guide.video_id,
        title: guide.title,
        summary: guide.summary,
        keywords: guide.keywords,
        difficulty: toDifficulty(guide.difficulty),
        status: guide.status,
        createdAt: guide.created_at,
        updatedAt: guide.updated_at,
        userId: guide.user_id,
      }))
    } catch (error) {
      logger.error('Error listing guides:', error)
      throw new Error('Failed to list guides')
    }
  }
}

export type { GuideMetadata } from './types'
