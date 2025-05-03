import { spawn } from 'child_process'
import { YtDlp } from '../yt-dlp'

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
  const onProgress = jest.fn((progress: unknown) => {
    console.log('onProgress called with:', progress)
  })
  let ytDlp: YtDlp

  beforeEach(() => {
    jest.clearAllMocks()
    ytDlp = new YtDlp()
  })

  describe('downloadVideo', () => {
    it('should successfully download a video', async () => {
      interface MockProcess {
        stdout: {
          on: jest.Mock
        }
        stderr: {
          on: jest.Mock
        }
        on: jest.Mock
      }

      const mockProcess: MockProcess = {
        stdout: {
          on: jest.fn((event: string, callback: (data: string) => void) => {
            if (event === 'data') {
              callback('[download]  33.3% of 10.00MB at 2.00MB/s ETA 00:10')
              callback('[download]  66.7% of 10.00MB at 2.00MB/s ETA 00:05')
              callback('[download] 100.0% of 10.00MB at 2.00MB/s ETA 00:00')
            }
            return mockProcess.stdout
          })
        },
        stderr: {
          on: jest.fn().mockReturnThis()
        },
        on: jest.fn((event: string, callback: (code: number) => void) => {
          if (event === 'close') {
            callback(0)
          }
          return mockProcess
        })
      }

      // Spy on parseProgress to add debug output
      const parseProgressSpy = jest.spyOn(ytDlp as unknown as YtDlp, 'parseProgress')
      parseProgressSpy.mockImplementation((...args: unknown[]) => {
        const output = args[0] as string
        const result = YtDlp.prototype['parseProgress'].call(ytDlp, output)
        console.log('parseProgress called with:', output, 'result:', result)
        return result
      })

      ;(spawn as jest.Mock).mockReturnValue(mockProcess)

      const result = await ytDlp.downloadVideo(validUrl, { outputPath: mockOutputPath, onProgress })

      expect(spawn).toHaveBeenCalledWith('yt-dlp', [
        validUrl,
        '-f', 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '-o', mockOutputPath,
        '--no-playlist',
        '--progress',
      ])

      // Wait for all callbacks to be processed
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(onProgress).toHaveBeenCalledTimes(3)

      expect(onProgress).toHaveBeenNthCalledWith(1, {
        percentage: 33.3,
        size: '10.00MB',
        speed: '2.00MB/s',
        eta: '00:10',
      })
      expect(onProgress).toHaveBeenNthCalledWith(2, {
        percentage: 66.7,
        size: '10.00MB',
        speed: '2.00MB/s',
        eta: '00:05',
      })
      expect(onProgress).toHaveBeenNthCalledWith(3, {
        percentage: 100.0,
        size: '10.00MB',
        speed: '2.00MB/s',
        eta: '00:00',
      })

      expect(result).toBe(mockOutputPath)
    })

    it('should throw error for invalid URL', async () => {
      await expect(ytDlp.downloadVideo(invalidUrl, { outputPath: mockOutputPath })).rejects.toThrow(
        'Invalid YouTube URL'
      )
    })

    it('should handle process errors', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              callback(Buffer.from('Error: something went wrong'))
            }
          }),
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(1)
          }
        }),
      }

      ;(spawn as jest.Mock).mockReturnValue(mockProcess)

      await expect(ytDlp.downloadVideo(validUrl, { outputPath: mockOutputPath })).rejects.toThrow(
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

      const promise = ytDlp.downloadVideo(validUrl, {
        outputPath: mockOutputPath,
        timeout: 100,
      })

      await expect(promise).rejects.toThrow('Download timeout')
      expect(mockProcess.kill).toHaveBeenCalled()
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

      const result = await ytDlp.getVideoMetadata(validUrl)
      expect(result).toEqual(mockMetadata)
      expect(spawn).toHaveBeenCalledWith('yt-dlp', [
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        validUrl,
      ])
    })

    it('should throw error for invalid URL', async () => {
      await expect(ytDlp.getVideoMetadata(invalidUrl)).rejects.toThrow('Invalid YouTube URL')
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

      await expect(ytDlp.getVideoMetadata(validUrl)).rejects.toThrow(
        'Failed to parse video metadata'
      )
    })
  })
})
