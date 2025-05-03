import { SupabaseClient } from '@supabase/supabase-js'
import { YtDlp } from './yt-dlp'
import { logger } from '@/config/logger'

export interface VideoFormat {
  formatId: string
  ext: string
  filesize: number
  acodec: string
  vcodec: string
}

export interface YtDlpFormat {
  format_id: string
  ext: string
  filesize: number
  acodec: string
  vcodec: string
}

export interface YtDlpMetadata {
  id: string
  title: string
  description: string
  duration: number
  thumbnail: string
  formats: YtDlpFormat[]
  upload_date: string
  uploader: string
  uploader_url: string
  view_count: number
  like_count: number
  tags?: string[]
}

export interface DatabaseRecord {
  video_id: string
  title: string
  description: string
  duration: number
  thumbnail: string
  formats: VideoFormat[]
  upload_date: string
  uploader: string
  uploader_url: string
  view_count: number
  like_count: number
  tags: string[]
}

export interface VideoMetadata {
  id: string
  title: string
  description: string
  duration: number
  thumbnail: string
  formats: VideoFormat[]
  upload_date: string
  uploader: string
  uploader_url: string
  view_count: number
  like_count: number
  tags: string[]
}

export class MetadataExtractor {
  private readonly ytDlp: YtDlp

  constructor(private readonly supabase: SupabaseClient) {
    this.ytDlp = new YtDlp()
  }

  private mapFormat(format: YtDlpFormat): VideoFormat {
    return {
      formatId: format.format_id,
      ext: format.ext,
      filesize: format.filesize,
      acodec: format.acodec,
      vcodec: format.vcodec,
    }
  }

  /**
   * Extract metadata from a YouTube video URL
   */
  async extractMetadata(url: string): Promise<VideoMetadata> {
    try {
      const metadata = await this.ytDlp.getVideoMetadata(url)
      return this.mapYtDlpMetadata(metadata)
    } catch (error) {
      logger.error('Failed to extract video metadata:', error)
      throw new Error('Failed to extract video metadata')
    }
  }

  /**
   * Save metadata to the database
   */
  async saveMetadata(videoId: string, metadata: VideoMetadata): Promise<void> {
    try {
      const { error } = await this.supabase.from('video_metadata').insert({
        video_id: videoId,
        title: metadata.title,
        description: metadata.description,
        duration: metadata.duration,
        thumbnail: metadata.thumbnail,
        formats: metadata.formats,
        upload_date: metadata.upload_date,
        uploader: metadata.uploader,
        uploader_url: metadata.uploader_url,
        view_count: metadata.view_count,
        like_count: metadata.like_count,
        tags: metadata.tags,
      })

      if (error) throw error
    } catch (error) {
      logger.error('Failed to save video metadata:', error)
      throw new Error('Failed to save video metadata')
    }
  }

  /**
   * Get metadata for a video
   */
  async getMetadata(videoId: string): Promise<VideoMetadata | null> {
    try {
      const { data, error } = await this.supabase
        .from('video_metadata')
        .select()
        .eq('video_id', videoId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // Record not found
        throw error
      }

      return data ? this.mapDatabaseRecord(data) : null
    } catch (error) {
      logger.error('Failed to get video metadata:', error)
      throw new Error('Failed to get video metadata')
    }
  }

  /**
   * Delete metadata for a video
   */
  async deleteMetadata(videoId: string): Promise<void> {
    try {
      const { error } = await this.supabase.from('video_metadata').delete().eq('video_id', videoId)

      if (error) throw error
    } catch (error) {
      logger.error('Failed to delete video metadata:', error)
      throw new Error('Failed to delete video metadata')
    }
  }

  /**
   * Map yt-dlp metadata to our format
   */
  private mapYtDlpMetadata(metadata: YtDlpMetadata): VideoMetadata {
    return {
      id: metadata.id,
      title: metadata.title,
      description: metadata.description,
      duration: metadata.duration,
      thumbnail: metadata.thumbnail,
      formats: metadata.formats.map((format) => this.mapFormat(format)),
      upload_date: metadata.upload_date,
      uploader: metadata.uploader,
      uploader_url: metadata.uploader_url,
      view_count: metadata.view_count,
      like_count: metadata.like_count,
      tags: metadata.tags || [],
    }
  }

  /**
   * Map database record to VideoMetadata
   */
  private mapDatabaseRecord(record: DatabaseRecord): VideoMetadata {
    return {
      id: record.video_id,
      title: record.title,
      description: record.description,
      duration: record.duration,
      thumbnail: record.thumbnail,
      formats: record.formats,
      upload_date: record.upload_date,
      uploader: record.uploader,
      uploader_url: record.uploader_url,
      view_count: record.view_count,
      like_count: record.like_count,
      tags: record.tags
    }
  }
}
