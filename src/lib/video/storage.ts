import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { logger } from '@/config/logger'
import http from 'http'
import { createServer } from 'http'

export class StorageError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message)
    this.name = 'StorageError'
    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class VideoStorage {
  private static readonly storageDir = path.join(os.tmpdir(), 'howtube-videos')
  private static readonly audioDir = path.join(os.tmpdir(), 'howtube-audio')
  private static server: http.Server | null = null
  private static serverPort = 3001
  private static serverUrl = `http://localhost:${VideoStorage.serverPort}`

  /**
   * Initialize storage directory and HTTP server
   */
  static async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true })
      await fs.mkdir(this.audioDir, { recursive: true })

      // Start HTTP server if not already running
      if (!this.server) {
        this.server = createServer(async (req, res) => {
          try {
            const url = new URL(req.url || '', this.serverUrl)
            const filePath = path.join(this.audioDir, path.basename(url.pathname))

            // Check if file exists
            try {
              await fs.access(filePath)
            } catch {
              res.writeHead(404)
              res.end('File not found')
              return
            }

            // Set CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'GET')
            res.setHeader('Content-Type', 'audio/mpeg')

            // Stream the file
            const fileStream = fs.createReadStream(filePath)
            fileStream.pipe(res)
          } catch (error) {
            logger.error('Error serving file:', error)
            res.writeHead(500)
            res.end('Internal server error')
          }
        })

        this.server.listen(this.serverPort)
        logger.info(`[Storage] Started HTTP server on port ${this.serverPort}`)
      }
    } catch (err) {
      logger.error('Failed to initialize video storage:', err)
      throw new StorageError(
        'Failed to initialize video storage',
        err instanceof Error ? err : undefined
      )
    }
  }

  /**
   * Get the full path for a video ID
   */
  static getStoragePath(videoId: string): string {
    return path.join(this.storageDir, videoId)
  }

  /**
   * Delete a video file
   */
  static async deleteVideo(videoId: string): Promise<void> {
    try {
      await fs.unlink(this.getStoragePath(videoId))
    } catch (err) {
      // Ignore if file doesn't exist
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return
      }
      logger.error('Failed to delete video:', err)
      throw new StorageError('Failed to delete video', err instanceof Error ? err : undefined)
    }
  }

  /**
   * Check if a video file exists
   */
  static async exists(videoId: string): Promise<boolean> {
    try {
      await fs.access(this.getStoragePath(videoId))
      return true
    } catch {
      return false
    }
  }

  /**
   * Get the path to a video file
   */
  static async getVideoPath(videoId: string): Promise<string> {
    try {
      const path = this.getStoragePath(videoId)
      await fs.access(path)
      return path
    } catch (err) {
      logger.error('Failed to get video path:', err)
      throw new StorageError('Video file not found', err instanceof Error ? err : undefined)
    }
  }

  /**
   * Get the size of a video file
   */
  static async getFileSize(videoId: string): Promise<number> {
    try {
      const stats = await fs.stat(this.getStoragePath(videoId))
      return stats.size
    } catch (err) {
      logger.error('Failed to get file size:', err)
      throw new StorageError('Failed to get file size', err instanceof Error ? err : undefined)
    }
  }

  /**
   * List all videos with metadata
   */
  static async listVideos(): Promise<Array<{ id: string; size: number; createdAt: Date }>> {
    try {
      const files = await fs.readdir(this.storageDir)
      const videos = await Promise.all(
        files.map(async file => {
          const stats = await fs.stat(path.join(this.storageDir, file))
          return {
            id: file,
            size: stats.size,
            createdAt: stats.mtime,
          }
        })
      )
      return videos
    } catch (err) {
      logger.error('Failed to list videos:', err)
      throw new StorageError('Failed to list videos', err instanceof Error ? err : undefined)
    }
  }

  /**
   * Clean up old video files
   */
  static async cleanup(maxAgeHours = 24): Promise<void> {
    try {
      const files = await fs.readdir(this.storageDir)
      const now = Date.now()
      const maxAge = maxAgeHours * 60 * 60 * 1000 // Convert hours to milliseconds

      await Promise.all(
        files.map(async file => {
          const filePath = path.join(this.storageDir, file)
          const stats = await fs.stat(filePath)

          if (now - stats.mtimeMs > maxAge) {
            await fs.unlink(filePath)
          }
        })
      )
    } catch (err) {
      logger.error('Failed to cleanup videos:', err)
      throw new StorageError('Failed to cleanup videos', err instanceof Error ? err : undefined)
    }
  }

  /**
   * Get the path for an audio file
   */
  private static getAudioPath(videoId: string): string {
    return path.join(this.audioDir, `${videoId}.mp3`)
  }

  /**
   * Upload an audio file
   */
  static async uploadAudio(videoId: string, audioPath: string): Promise<string> {
    try {
      const targetPath = this.getAudioPath(videoId)
      // Ensure the audio directory exists
      await fs.mkdir(this.audioDir, { recursive: true })
      await fs.copyFile(audioPath, targetPath)
      // Return a URL that AssemblyAI can access
      return `${this.serverUrl}/${videoId}.mp3`
    } catch (err) {
      logger.error('Failed to upload audio:', err)
      throw new StorageError('Failed to upload audio', err instanceof Error ? err : undefined)
    }
  }

  /**
   * Delete an audio file
   */
  static async deleteAudio(videoId: string): Promise<void> {
    try {
      await fs.unlink(this.getAudioPath(videoId))
    } catch (err) {
      // Ignore if file doesn't exist
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return
      }
      logger.error('Failed to delete audio:', err)
      throw new StorageError('Failed to delete audio', err instanceof Error ? err : undefined)
    }
  }

  /**
   * Shutdown the HTTP server
   */
  static async shutdown(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server!.close(err => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
      this.server = null
      logger.info('[Storage] HTTP server stopped')
    }
  }
}
