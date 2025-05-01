import { extractAudio } from '../audio'
import { VideoStorage } from '@/lib/video/storage'
import { logger } from '@/config/logger'
import { spawn } from 'child_process'

// Mock dependencies
jest.mock('@/lib/video/storage')
jest.mock('@/config/logger')
jest.mock('child_process')

describe('Audio Extraction', () => {
  const mockVideoId = 'test-video-id'
  const mockVideoPath = '/path/to/video.mp4'

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock VideoStorage.getVideoPath
    ;(VideoStorage.getVideoPath as jest.Mock).mockResolvedValue(mockVideoPath)
    
    // Mock spawn
    const mockSpawn = spawn as jest.Mock
    mockSpawn.mockReturnValue({
      stdout: {
        on: jest.fn(),
      },
      stderr: {
        on: jest.fn(),
      },
      on: jest.fn((event, callback) => {
        if (event === 'close') {
          callback(0) // Simulate successful process completion
        }
      }),
    })
  })

  it('should extract audio from video file', async () => {
    const result = await extractAudio(mockVideoId)

    // Verify VideoStorage.getVideoPath was called
    expect(VideoStorage.getVideoPath).toHaveBeenCalledWith(mockVideoId)

    // Verify ffmpeg was called with correct arguments
    expect(spawn).toHaveBeenCalledWith('ffmpeg', [
      '-i', mockVideoPath,
      '-vn',  // Disable video
      '-acodec', 'libmp3lame',
      '-ab', '128k',
      '-ar', '44100',
      '-y',  // Overwrite output file
      expect.any(String), // Output path
    ])

    // Verify the result is the path to the extracted audio
    expect(result).toMatch(/\.mp3$/)
  })

  it('should handle missing video file', async () => {
    ;(VideoStorage.getVideoPath as jest.Mock).mockRejectedValue(
      new Error('Video file not found')
    )

    await expect(extractAudio(mockVideoId)).rejects.toThrow(
      'Failed to extract audio: Video file not found'
    )
    expect(logger.error).toHaveBeenCalled()
  })

  it('should handle ffmpeg process error', async () => {
    const mockSpawn = spawn as jest.Mock
    mockSpawn.mockReturnValue({
      stdout: {
        on: jest.fn(),
      },
      stderr: {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('ffmpeg error message'))
          }
        }),
      },
      on: jest.fn((event, callback) => {
        if (event === 'close') {
          callback(1) // Simulate process error
        }
      }),
    })

    await expect(extractAudio(mockVideoId)).rejects.toThrow(
      'Failed to extract audio: ffmpeg process failed'
    )
    expect(logger.error).toHaveBeenCalled()
  })

  it('should handle spawn error', async () => {
    const mockSpawn = spawn as jest.Mock
    mockSpawn.mockReturnValue({
      stdout: {
        on: jest.fn(),
      },
      stderr: {
        on: jest.fn(),
      },
      on: jest.fn((event, callback) => {
        if (event === 'error') {
          callback(new Error('Failed to spawn process'))
        }
      }),
    })

    await expect(extractAudio(mockVideoId)).rejects.toThrow(
      'Failed to extract audio: Failed to spawn process'
    )
    expect(logger.error).toHaveBeenCalled()
  })
}) 