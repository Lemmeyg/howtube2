import { extractAudio, AudioError } from '../audio'
import { VideoStorage } from '@/lib/video/storage'
import { spawn } from 'child_process'
import path from 'path'
import os from 'os'

// Mock dependencies
jest.mock('@/lib/video/storage')
jest.mock('@/config/logger')
jest.mock('child_process')

describe('Audio Extraction', () => {
  const mockVideoId = 'test-video-id'
  const mockVideoPath = '/path/to/video.mp4'
  const mockOutputPath = path.join(os.tmpdir(), `${mockVideoId}.mp3`)

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock VideoStorage.getVideoPath
    ;(VideoStorage.getVideoPath as jest.Mock).mockResolvedValue(mockVideoPath)
  })

  it('should extract audio from video file', async () => {
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
          callback(0)
        }
      }),
    })

    await extractAudio(mockVideoPath, mockOutputPath)

    // Verify ffmpeg command was called correctly
    expect(spawn).toHaveBeenCalledWith('ffmpeg', [
      '-i',
      mockVideoPath,
      '-vn',
      '-acodec',
      'libmp3lame',
      '-q:a',
      '4',
      mockOutputPath,
    ])
  })

  it('should handle missing video file', async () => {
    // Mock spawn to simulate error
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
          callback(new Error('Video file not found'))
        }
      }),
    })

    await expect(extractAudio(mockVideoPath, mockOutputPath)).rejects.toThrow(AudioError)
    await expect(extractAudio(mockVideoPath, mockOutputPath)).rejects.toThrow(
      'Failed to extract audio'
    )
  })

  it('should handle ffmpeg process error', async () => {
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
          callback(1) // Exit with error code
        }
      }),
    })

    await expect(extractAudio(mockVideoPath, mockOutputPath)).rejects.toThrow(AudioError)
    await expect(extractAudio(mockVideoPath, mockOutputPath)).rejects.toThrow(
      'Failed to extract audio'
    )
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
          callback(new Error('Spawn error'))
        }
      }),
    })

    await expect(extractAudio(mockVideoPath, mockOutputPath)).rejects.toThrow(AudioError)
    await expect(extractAudio(mockVideoPath, mockOutputPath)).rejects.toThrow(
      'Failed to extract audio'
    )
  })
}) 