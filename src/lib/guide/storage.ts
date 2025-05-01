import { SupabaseClient } from '@supabase/supabase-js'
import { Guide } from './openai'
import { logger } from '@/config/logger'

export interface GuideMetadata {
  id: string
  videoId: string
  title: string
  summary: string
  keywords: string[]
  difficulty: string
  status: 'generating' | 'completed' | 'error'
  error?: string
  createdAt: string
  updatedAt: string
  userId: string
}

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

export class GuideStorage {
  constructor(private supabase: SupabaseClient) {}

  async createGuide(
    videoId: string,
    userId: string
  ): Promise<{ id: string }> {
    try {
      const { data, error } = await this.supabase
        .from('video_guides')
        .insert({
          video_id: videoId,
          user_id: userId,
          status: 'generating',
        })
        .select('id')
        .single()

      if (error) throw error
      return { id: data.id }
    } catch (error) {
      logger.error('Error creating guide:', error)
      throw new Error('Failed to create guide')
    }
  }

  async updateGuide(
    guideId: string,
    guide: Guide
  ): Promise<void> {
    try {
      // Start a transaction
      const { error } = await this.supabase.rpc('update_guide', {
        p_guide_id: guideId,
        p_title: guide.title,
        p_summary: guide.summary,
        p_keywords: guide.keywords,
        p_difficulty: guide.difficulty,
        p_sections: guide.sections,
        p_status: 'completed',
      })

      if (error) throw error
    } catch (error) {
      logger.error('Error updating guide:', error)
      throw new Error('Failed to update guide')
    }
  }

  async markGuideError(
    guideId: string,
    error: string
  ): Promise<void> {
    try {
      const { error: dbError } = await this.supabase
        .from('video_guides')
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

  async getGuideMetadata(
    guideId: string
  ): Promise<GuideMetadata> {
    try {
      const { data, error } = await this.supabase
        .from('video_guides')
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
        difficulty: data.difficulty,
        status: data.status,
        error: data.error,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        userId: data.user_id,
      }
    } catch (error) {
      logger.error('Error getting guide metadata:', error)
      throw new Error('Failed to get guide metadata')
    }
  }

  async getGuideContent(
    guideId: string
  ): Promise<GuideContent> {
    try {
      const { data, error } = await this.supabase
        .from('video_guide_sections')
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

  async deleteGuide(
    guideId: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('video_guides')
        .delete()
        .eq('id', guideId)

      if (error) throw error
    } catch (error) {
      logger.error('Error deleting guide:', error)
      throw new Error('Failed to delete guide')
    }
  }

  async listGuides(
    userId: string,
    videoId?: string
  ): Promise<GuideMetadata[]> {
    try {
      let query = this.supabase
        .from('video_guides')
        .select('*')
        .eq('user_id', userId)

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
        difficulty: guide.difficulty,
        status: guide.status,
        error: guide.error,
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