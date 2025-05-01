import { spawn } from 'child_process'
import path from 'path'
import { logger } from '@/config/logger'
import { extractYouTubeVideoId } from '../validation/youtube'
import { VideoStorage } from '@/lib/video/video-storage'

interface DownloadProgress {
  percentage: number
  speed: string
  eta: string
  size: string
}

interface DownloadOptions {
  format?: string
  outputPath: string
  onProgress?: (progress: DownloadProgress) => void
  timeout?: number
  maxRetries?: number
}

interface VideoMetadata {
  id: string
  title: string
  description: string
  duration: number
  thumbnail: string
  formats: Array<{
    format_id: string
    ext: string
    filesize: number
    acodec: string
    vcodec: string
  }>
}

export class YtDlpError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message)
    this.name = 'YtDlpError'
  }
}

export class YtDlp {
  private static readonly DEFAULT_FORMAT =
    'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
  private static readonly DEFAULT_TIMEOUT = 300000 // 5 minutes
  private static readonly DEFAULT_MAX_RETRIES = 3
  private static readonly PROGRESS_REGEX =
    /\[download\]\s+(\d+\.?\d*)%\s+of\s+~?\s*(\S+)\s+at\s+(\S+)\s+ETA\s+(\S+)/

  /**
   * Downloads a YouTube video using yt-dlp
   */
  static async downloadVideo(url: string, options: DownloadOptions): Promise<string> {
    const {
      format = this.DEFAULT_FORMAT,
      outputPath,
      onProgress,
      timeout = this.DEFAULT_TIMEOUT,
      maxRetries = this.DEFAULT_MAX_RETRIES,
    } = options

    const videoId = extractYouTubeVideoId(url)
    if (!videoId) {
      throw new YtDlpError('Invalid YouTube URL')
    }

    const outputTemplate = path.join(outputPath, `${videoId}.%(ext)s`)
    let currentTry = 0

    while (currentTry < maxRetries) {
      try {
        const args = [
          url,
          '--format',
          format,
          '--output',
          outputTemplate,
          '--no-playlist',
          '--no-warnings',
        ]

        const process = spawn('yt-dlp', args)
        let outputFile: string | undefined

        return await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            process.kill()
            reject(new YtDlpError('Download timeout', 'TIMEOUT'))
          }, timeout)

          process.stdout.on('data', data => {
            const output = data.toString()
            // Check for output file path in the output
            const match = output.match(/\[download\] Destination: (.+)/)
            if (match) {
              outputFile = match[1]
            }

            // Parse progress information
            const progressMatch = output.match(this.PROGRESS_REGEX)
            if (progressMatch && onProgress) {
              onProgress({
                percentage: parseFloat(progressMatch[1]),
                size: progressMatch[2],
                speed: progressMatch[3],
                eta: progressMatch[4],
              })
            }
          })

          process.stderr.on('data', data => {
            logger.error('yt-dlp error:', data.toString())
          })

          process.on('close', code => {
            clearTimeout(timer)
            if (code === 0 && outputFile) {
              resolve(outputFile)
            } else {
              reject(new YtDlpError(`yt-dlp process exited with code ${code}`, 'PROCESS_ERROR'))
            }
          })

          process.on('error', error => {
            clearTimeout(timer)
            reject(new YtDlpError(error.message, 'SPAWN_ERROR'))
          })
        })
      } catch (error) {
        currentTry++
        if (currentTry === maxRetries) {
          throw error
        }
        logger.warn(`Download attempt ${currentTry} failed, retrying...`)
        await new Promise(resolve => setTimeout(resolve, 1000 * currentTry))
      }
    }

    throw new YtDlpError('Max retries exceeded')
  }

  /**
   * Fetches metadata for a YouTube video
   */
  static async getVideoMetadata(url: string): Promise<VideoMetadata> {
    const videoId = extractYouTubeVideoId(url)
    if (!videoId) {
      throw new YtDlpError('Invalid YouTube URL')
    }

    const args = [url, '--dump-json', '--no-playlist', '--no-warnings']

    const process = spawn('yt-dlp', args)

    return new Promise((resolve, reject) => {
      let output = ''

      process.stdout.on('data', data => {
        output += data.toString()
      })

      process.stderr.on('data', data => {
        logger.error('yt-dlp error:', data.toString())
      })

      process.on('close', code => {
        if (code === 0) {
          try {
            const metadata = JSON.parse(output)
            resolve({
              id: metadata.id,
              title: metadata.title,
              description: metadata.description,
              duration: metadata.duration,
              thumbnail: metadata.thumbnail,
              formats: metadata.formats,
            })
          } catch (err) {
            logger.error('Failed to parse video metadata:', err)
            reject(
              new YtDlpError(
                'Failed to parse video metadata',
                err instanceof Error ? err.message : undefined
              )
            )
          }
        } else {
          const errorMsg = `yt-dlp process exited with code ${code}`
          logger.error(errorMsg)
          reject(new YtDlpError(errorMsg, 'PROCESS_ERROR'))
        }
      })

      process.on('error', error => {
        reject(new YtDlpError(error.message, 'SPAWN_ERROR'))
      })
    })
  }

  /**
   * Delete a downloaded video
   */
  static async deleteVideo(videoId: string): Promise<void> {
    try {
      await VideoStorage.deleteVideo(videoId)
    } catch (err) {
      logger.error('Failed to delete video:', err)
      throw new YtDlpError('Failed to delete video', err instanceof Error ? err : undefined)
    }
  }
}
