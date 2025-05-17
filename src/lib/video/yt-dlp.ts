import { spawn } from 'child_process'
import path from 'path'
import { logger } from '@/config/logger'
import { extractYouTubeVideoId } from '../validation/youtube'
import { YtDlpMetadata } from './metadata'
import fs from 'fs/promises'
import { tmpdir } from 'os'

interface DownloadProgress {
  percentage: number
  speed: string
  eta: string
  size: string
}

export class YtDlpError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'YtDlpError'
  }
}

export class YtDlp {
  private static readonly DEFAULT_FORMAT =
    'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
  private static readonly DOWNLOAD_DIR = path.join(tmpdir(), 'howtube', 'videos')

  /**
   * Ensures the download directory exists
   */
  private async ensureDownloadDir(): Promise<void> {
    try {
      await fs.mkdir(YtDlp.DOWNLOAD_DIR, { recursive: true })
    } catch (error) {
      logger.error('Failed to create download directory:', error)
      throw new YtDlpError('Failed to create download directory', error as Error)
    }
  }

  /**
   * Downloads a YouTube video
   */
  async downloadVideo(
    url: string,
    options: {
      outputPath?: string
      onProgress?: (progress: DownloadProgress) => void
      timeout?: number
    } = {}
  ): Promise<string> {
    const videoId = extractYouTubeVideoId(url)
    if (!videoId) {
      throw new YtDlpError('Invalid YouTube URL')
    }

    // Ensure download directory exists
    await this.ensureDownloadDir()

    const outputPath = options.outputPath || path.join(YtDlp.DOWNLOAD_DIR, `${videoId}.mp4`)
    logger.info(`[YtDlp] Downloading video to ${outputPath}`)

    const args = [url, '-f', YtDlp.DEFAULT_FORMAT, '-o', outputPath, '--no-playlist', '--progress']

    const ytDlp = spawn('yt-dlp', args)

    return new Promise((resolve, reject) => {
      let stderr = ''
      let timeoutId: NodeJS.Timeout | undefined

      if (options.timeout) {
        timeoutId = setTimeout(() => {
          ytDlp.kill()
          reject(new YtDlpError('Download timeout'))
        }, options.timeout)
      }

      ytDlp.stdout.on('data', data => {
        if (options.onProgress) {
          const progress = this.parseProgress(data.toString())
          if (progress) {
            options.onProgress(progress)
          }
        }
      })

      ytDlp.stderr.on('data', data => {
        stderr += data.toString()
        logger.debug(`[YtDlp] stderr: ${data}`)
      })

      ytDlp.on('close', async code => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        if (code === 0) {
          // Verify the file exists
          try {
            await fs.access(outputPath)
            logger.info(`[YtDlp] Download complete: ${outputPath}`)
            resolve(outputPath)
          } catch (error) {
            reject(new YtDlpError(`Downloaded file not found at ${outputPath}`, error as Error))
          }
        } else {
          reject(new YtDlpError(`yt-dlp process exited with code ${code}: ${stderr}`))
        }
      })

      ytDlp.on('error', error => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        reject(new YtDlpError('Failed to spawn yt-dlp', error))
      })
    })
  }

  /**
   * Fetches metadata for a YouTube video
   */
  async getVideoMetadata(url: string): Promise<YtDlpMetadata> {
    const videoId = extractYouTubeVideoId(url)
    if (!videoId) {
      throw new YtDlpError('Invalid YouTube URL')
    }

    const args = ['--dump-json', '--no-playlist', '--no-warnings', url]
    const ytDlp = spawn('yt-dlp', args)

    return new Promise((resolve, reject) => {
      let stdout = ''
      let stderr = ''

      ytDlp.stdout.on('data', data => {
        stdout += data.toString()
      })

      ytDlp.stderr.on('data', data => {
        stderr += data.toString()
      })

      ytDlp.on('close', code => {
        if (code === 0) {
          try {
            const metadata = JSON.parse(stdout)
            resolve(metadata)
          } catch (error) {
            logger.error('Failed to parse video metadata:', error)
            reject(new YtDlpError('Failed to parse video metadata', error as Error))
          }
        } else {
          const errorMsg = `yt-dlp exited with code ${code}: ${stderr}`
          logger.error(errorMsg)
          reject(new YtDlpError(errorMsg))
        }
      })

      ytDlp.on('error', error => {
        reject(new YtDlpError('Failed to spawn yt-dlp', error))
      })
    })
  }

  /**
   * Parses progress output from yt-dlp
   */
  public parseProgress(output: string): DownloadProgress | null {
    // Matches: [download] 28.7% of 231.51KiB at 81.40KiB/s ETA 00:02
    const progressMatch = output.match(
      /\[download\]\s+(\d+\.\d+)% of ([\d\.]+\w+) at ([\d\.]+\w+\/s) ETA (\d+:\d+)/
    )

    if (progressMatch) {
      const [, percentage, size, speed, eta] = progressMatch
      return {
        percentage: parseFloat(percentage),
        size,
        speed,
        eta,
      }
    }

    return null
  }
}
