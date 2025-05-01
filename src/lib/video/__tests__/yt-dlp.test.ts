import { spawn } from 'child_process'
import { YtDlp, YtDlpError } from '../yt-dlp'

// Mock dependencies
jest.mock('child_process')
jest.mock('../storage')
jest.mock('@/config/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

describe('YtDlp', () => {
  const validUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  const invalidUrl = 'https://example.com/video'
  const mockVideoId = 'dQw4w9WgXcQ'
  const mockOutputPath = '/tmp/videos'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('downloadVideo', () => {
    it('should successfully download a video', async () => {
      const mockProcess = {
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('[download] Destination: /tmp/videos/video.mp4'))
              callback(Buffer.from('[download] 50.0% of 10.00MB at 1.00MB/s ETA 00:05'))
            }
          }),
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0)
          }
        }),
      }

      ;(spawn as jest.Mock).mockReturnValue(mockProcess)

      const onProgress = jest.fn()
      const result = await YtDlp.downloadVideo(validUrl, {
        outputPath: mockOutputPath,
        onProgress,
      })

      expect(result).toBe('/tmp/videos/video.mp4')
      expect(spawn).toHaveBeenCalledWith('yt-dlp', expect.any(Array))
      expect(onProgress).toHaveBeenCalledWith({
        percentage: 50.0,
        size: '10.00MB',
        speed: '1.00MB/s',
        eta: '00:05',
      })
    })

    it('should throw error for invalid URL', async () => {
      await expect(YtDlp.downloadVideo(invalidUrl, { outputPath: mockOutputPath })).rejects.toThrow(
        YtDlpError
      )
    })

    it('should handle process errors', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(1)
          }
        }),
      }

      ;(spawn as jest.Mock).mockReturnValue(mockProcess)

      await expect(YtDlp.downloadVideo(validUrl, { outputPath: mockOutputPath })).rejects.toThrow(
        'yt-dlp process exited with code 1'
      )
    })

    it('should handle timeouts', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
      }

      ;(spawn as jest.Mock).mockReturnValue(mockProcess)

      await expect(
        YtDlp.downloadVideo(validUrl, {
          outputPath: mockOutputPath,
          timeout: 100,
        })
      ).rejects.toThrow('Download timeout')
    })
  })

  describe('getVideoMetadata', () => {
    const mockMetadata = {
      id: mockVideoId,
      title: 'Test Video',
      description: 'Test Description',
      duration: 180,
      thumbnail: 'https://example.com/thumb.jpg',
      formats: [
        {
          format_id: '22',
          ext: 'mp4',
          filesize: 1000000,
          acodec: 'aac',
          vcodec: 'h264',
        },
      ],
    }

    it('should successfully fetch video metadata', async () => {
      const mockProcess = {
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from(JSON.stringify(mockMetadata)))
            }
          }),
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0)
          }
        }),
      }

      ;(spawn as jest.Mock).mockReturnValue(mockProcess)

      const result = await YtDlp.getVideoMetadata(validUrl)
      expect(result).toEqual(mockMetadata)
      expect(spawn).toHaveBeenCalledWith('yt-dlp', expect.any(Array))
    })

    it('should throw error for invalid URL', async () => {
      await expect(YtDlp.getVideoMetadata(invalidUrl)).rejects.toThrow(YtDlpError)
    })

    it('should handle invalid JSON response', async () => {
      const mockProcess = {
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('invalid json'))
            }
          }),
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0)
          }
        }),
      }

      ;(spawn as jest.Mock).mockReturnValue(mockProcess)

      await expect(YtDlp.getVideoMetadata(validUrl)).rejects.toThrow(
        'Failed to parse video metadata'
      )
    })
  })
})
