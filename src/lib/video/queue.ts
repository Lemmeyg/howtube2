import { SupabaseClient } from '@supabase/supabase-js'
import { VideoStorage } from './storage'
import { logger } from '@/config/logger'

export type ProcessingStatus = 'pending' | 'downloading' | 'downloaded' | 'failed'

export interface QueueItem {
  id: string
  userId: string
  videoId: string
  url: string
  status: ProcessingStatus
  progress: number
  speed?: string
  eta?: string
  size?: string
  error?: string
  createdAt: Date
  updatedAt: Date
}

interface DatabaseRecord {
  id: string
  user_id: string
  video_id: string
  url: string
  status: ProcessingStatus
  progress: number
  speed?: string
  eta?: string
  size?: string
  error?: string
  created_at: string
  updated_at: string
}

export class ProcessingQueue {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Add a new video to the processing queue
   */
  async addToQueue(userId: string, url: string, videoId: string): Promise<QueueItem> {
    try {
      const { data, error } = await this.supabase
        .from('video_processing')
        .insert({
          user_id: userId,
          video_id: videoId,
          video_url: url,
          status: 'pending',
          progress: 0,
        })
        .select()
        .single()

      if (error) throw error

      return this.mapDatabaseRecord(data)
    } catch (error) {
      // Improved error logging
      let message = ''
      let details = ''
      let code = ''
      if (typeof error === 'object' && error !== null) {
        if ('message' in error && typeof error.message === 'string') message = error.message
        if ('details' in error && typeof error.details === 'string') details = error.details
        if ('code' in error && typeof error.code === 'string') code = error.code
      }
      console.error('Failed to add video to queue:', error, message, details, code)
      logger.error(
        'Failed to add video to queue:',
        JSON.stringify(error, Object.getOwnPropertyNames(error))
      )
      throw new Error('Failed to add video to queue')
    }
  }

  /**
   * Get the status of a video in the queue by id (UUID)
   */
  async getStatus(videoId: string): Promise<QueueItem | null> {
    try {
      const { data, error } = await this.supabase
        .from('video_processing')
        .select()
        .eq('video_id', videoId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // Record not found
        throw error
      }

      return data ? this.mapDatabaseRecord(data) : null
    } catch (error) {
      logger.error('Failed to get video status:', error)
      throw new Error('Failed to get video status')
    }
  }

  /**
   * Update the status and progress of a video in the queue by id (UUID)
   */
  async updateStatus(
    videoId: string,
    status: ProcessingStatus,
    progress: number = 0,
    details: Partial<QueueItem> = {}
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('video_processing')
        .update({
          status,
          progress,
          ...details,
          updated_at: new Date().toISOString(),
        })
        .eq('video_id', videoId)

      if (error) throw error
    } catch (error) {
      logger.error('Failed to update video status:', error)
      throw new Error('Failed to update video status')
    }
  }

  /**
   * Remove a video from the queue by id (UUID)
   */
  async removeFromQueue(videoId: string): Promise<void> {
    try {
      // Get the video_id for cleanup
      const { data, error: fetchError } = await this.supabase
        .from('video_processing')
        .select('video_id')
        .eq('video_id', videoId)
        .single()
      if (fetchError || !data) throw fetchError || new Error('Video not found')

      const { error } = await this.supabase
        .from('video_processing')
        .delete()
        .eq('video_id', videoId)

      if (error) throw error

      // Also clean up any temporary files
      await VideoStorage.deleteVideo(data.video_id)
    } catch (error) {
      logger.error('Failed to remove video from queue:', error)
      throw new Error('Failed to remove video from queue')
    }
  }

  /**
   * Get all videos in the queue for a user
   */
  async getUserQueue(userId: string): Promise<QueueItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('video_processing')
        .select()
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data.map(this.mapDatabaseRecord)
    } catch (error) {
      logger.error('Failed to get user queue:', error)
      throw new Error('Failed to get user queue')
    }
  }

  /**
   * Clean up completed or failed videos older than the specified age
   */
  async cleanupOldRecords(maxAgeHours: number = 24): Promise<void> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours)

      const { data, error } = await this.supabase
        .from('video_processing')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .in('status', ['downloaded', 'failed'])
        .select('id, video_id')

      if (error) throw error

      // Clean up temporary files for deleted records
      if (data) {
        await Promise.all(data.map(record => VideoStorage.deleteVideo(record.video_id)))
      }
    } catch (error) {
      logger.error('Failed to cleanup old records:', error)
      throw new Error('Failed to cleanup old records')
    }
  }

  /**
   * Map a database record to a QueueItem
   */
  private mapDatabaseRecord(record: DatabaseRecord): QueueItem {
    return {
      id: record.id,
      userId: record.user_id,
      videoId: record.video_id,
      url: record.url,
      status: record.status,
      progress: record.progress,
      speed: record.speed,
      eta: record.eta,
      size: record.size,
      error: record.error,
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
    }
  }
}
