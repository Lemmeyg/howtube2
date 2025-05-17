import { spawn } from 'child_process'
import { logger } from '@/config/logger'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import fs from 'fs'

export class AudioError extends Error {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message)
    this.name = 'AudioError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Check if ffmpeg is installed
 */
async function checkFFmpeg(): Promise<boolean> {
  try {
    const ffmpeg = spawn('ffmpeg', ['-version'])
    return new Promise(resolve => {
      ffmpeg.on('close', code => resolve(code === 0))
      ffmpeg.on('error', () => resolve(false))
    })
  } catch {
    return false
  }
}

/**
 * Extract audio from a video file using ffmpeg
 */
export async function extractAudio(videoPath: string, outputPath: string): Promise<void> {
  logger.info(`[Audio] Starting audio extraction from ${videoPath} to ${outputPath}`)

  // Check if ffmpeg is installed
  const hasFFmpeg = await checkFFmpeg()
  if (!hasFFmpeg) {
    logger.error('[Audio] FFmpeg is not installed')
    throw new AudioError('FFmpeg is not installed. Please install FFmpeg to process videos.')
  }
  logger.info('[Audio] FFmpeg is installed')

  // Check if video file exists
  if (!existsSync(videoPath)) {
    logger.error(`[Audio] Video file not found: ${videoPath}`)
    throw new AudioError(`Video file not found: ${videoPath}`)
  }
  logger.info(`[Audio] Video file exists at ${videoPath}`)

  // Ensure output directory exists
  const outputDir = join(tmpdir(), 'howtube')
  if (!existsSync(outputDir)) {
    logger.info(`[Audio] Creating output directory: ${outputDir}`)
    await fs.promises.mkdir(outputDir, { recursive: true })
  }
  logger.info(`[Audio] Output directory exists: ${outputDir}`)

  try {
    logger.info('[Audio] Starting FFmpeg process')
    const ffmpeg = spawn('ffmpeg', [
      '-i',
      videoPath,
      '-vn',
      '-acodec',
      'libmp3lame',
      '-q:a',
      '4',
      '-y',
      '-loglevel',
      'info',
      outputPath,
    ])

    return new Promise((resolve, reject) => {
      let errorOutput = ''
      let stdoutOutput = ''

      ffmpeg.stdout.on('data', data => {
        const output = data.toString()
        stdoutOutput += output
        logger.info(`[Audio] FFmpeg stdout: ${output}`)
      })

      ffmpeg.stderr.on('data', data => {
        const output = data.toString()
        errorOutput += output
        logger.info(`[Audio] FFmpeg stderr: ${output}`)
      })

      ffmpeg.on('close', code => {
        logger.info(`[Audio] FFmpeg process exited with code ${code}`)
        if (code === 0) {
          logger.info(`[Audio] FFmpeg process completed successfully`)
          logger.info(`[Audio] FFmpeg stdout: ${stdoutOutput}`)
          resolve()
        } else {
          logger.error(`[Audio] FFmpeg process failed with code ${code}`)
          logger.error(`[Audio] FFmpeg stderr: ${errorOutput}`)
          reject(new AudioError(`Failed to extract audio: ${errorOutput}`))
        }
      })

      ffmpeg.on('error', error => {
        logger.error(`[Audio] FFmpeg process error: ${error.message}`)
        logger.error(`[Audio] FFmpeg error details:`, error)
        reject(new AudioError(`Failed to extract audio: ${error.message}`, error))
      })

      const timeout = setTimeout(
        () => {
          ffmpeg.kill()
          logger.error('[Audio] FFmpeg process timed out after 5 minutes')
          reject(new AudioError('FFmpeg process timed out after 5 minutes'))
        },
        5 * 60 * 1000
      )

      ffmpeg.on('close', () => clearTimeout(timeout))
    })
  } catch (err) {
    logger.error('[Audio] Failed to extract audio:', err)
    throw new AudioError('Failed to extract audio', err instanceof Error ? err : undefined)
  }
}
