import { spawn } from 'child_process'
import { logger } from '@/config/logger'

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
 * Extract audio from a video file using ffmpeg
 */
export async function extractAudio(videoPath: string, outputPath: string): Promise<void> {
  try {
    const ffmpeg = spawn('ffmpeg', [
      '-i',
      videoPath,
      '-vn',
      '-acodec',
      'libmp3lame',
      '-q:a',
      '4',
      outputPath,
    ])

    return new Promise((resolve, reject) => {
      ffmpeg.stdout.on('data', data => {
        logger.debug(`ffmpeg stdout: ${data}`)
      })

      ffmpeg.stderr.on('data', data => {
        logger.debug(`ffmpeg stderr: ${data}`)
      })

      ffmpeg.on('close', code => {
        if (code === 0) {
          resolve()
        } else {
          reject(new AudioError('Failed to extract audio'))
        }
      })

      ffmpeg.on('error', error => {
        reject(new AudioError('Failed to extract audio', error))
      })
    })
  } catch (err) {
    logger.error('Failed to extract audio:', err)
    throw new AudioError('Failed to extract audio', err instanceof Error ? err : undefined)
  }
}
