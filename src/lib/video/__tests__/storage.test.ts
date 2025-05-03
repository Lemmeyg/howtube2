import fs from 'fs/promises'
import { VideoStorage, StorageError } from '../storage'

// Mock dependencies
jest.mock('fs/promises')
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...args) => args.join('/')),
}))
jest.mock('os', () => ({
  tmpdir: jest.fn(() => '/tmp'),
}))
jest.mock('@/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}))

describe('VideoStorage', () => {
  const mockVideoId = 'test-video-123'
  const mockTempDir = '/tmp/howtube-videos'
  const mockVideoPath = `${mockTempDir}/${mockVideoId}`

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('initialize', () => {
    it('should create storage directory if it does not exist', async () => {
      await VideoStorage.initialize()
      expect(fs.mkdir).toHaveBeenCalledWith(mockTempDir, { recursive: true })
    })

    it('should handle directory creation errors', async () => {
      const error = new Error('Permission denied')
      ;(fs.mkdir as jest.Mock).mockRejectedValue(error)

      await expect(VideoStorage.initialize()).rejects.toThrow(StorageError)
      await expect(VideoStorage.initialize()).rejects.toThrow('Failed to initialize video storage')
      await expect(VideoStorage.initialize()).rejects.toMatchObject({
        cause: error
      })
    })
  })

  describe('getStoragePath', () => {
    it('should return correct path for video ID', () => {
      const result = VideoStorage.getStoragePath(mockVideoId)
      expect(result).toBe(mockVideoPath)
    })
  })

  describe('cleanup', () => {
    it('should remove old files', async () => {
      const mockFiles = ['old-video', 'new-video']
      const now = Date.now()
      const oldTime = now - 25 * 60 * 60 * 1000 // 25 hours ago
      const newTime = now - 1 * 60 * 60 * 1000 // 1 hour ago

      ;(fs.readdir as jest.Mock).mockResolvedValue(mockFiles)
      ;(fs.stat as jest.Mock).mockImplementation(path => {
        return Promise.resolve({
          mtimeMs: path.includes('old-video') ? oldTime : newTime,
        })
      })

      await VideoStorage.cleanup()

      expect(fs.unlink).toHaveBeenCalledWith(`${mockTempDir}/old-video`)
      expect(fs.unlink).not.toHaveBeenCalledWith(`${mockTempDir}/new-video`)
    })

    it('should handle cleanup errors gracefully', async () => {
      const error = new Error('Permission denied')
      ;(fs.readdir as jest.Mock).mockRejectedValue(error)

      await expect(VideoStorage.cleanup()).rejects.toThrow(StorageError)
      await expect(VideoStorage.cleanup()).rejects.toThrow('Failed to cleanup videos')
      await expect(VideoStorage.cleanup()).rejects.toMatchObject({
        cause: error
      })
    })
  })

  describe('deleteVideo', () => {
    it('should delete video file', async () => {
      await VideoStorage.deleteVideo(mockVideoId)
      expect(fs.unlink).toHaveBeenCalledWith(mockVideoPath)
    })

    it('should handle non-existent files', async () => {
      const error = new Error('File not found')
      ;(error as NodeJS.ErrnoException).code = 'ENOENT'
      ;(fs.unlink as jest.Mock).mockRejectedValue(error)

      await expect(VideoStorage.deleteVideo(mockVideoId)).resolves.not.toThrow()
    })

    it('should handle deletion errors', async () => {
      const error = new Error('Permission denied')
      ;(fs.unlink as jest.Mock).mockRejectedValue(error)

      await expect(VideoStorage.deleteVideo(mockVideoId)).rejects.toThrow(StorageError)
      await expect(VideoStorage.deleteVideo(mockVideoId)).rejects.toThrow('Failed to delete video')
      await expect(VideoStorage.deleteVideo(mockVideoId)).rejects.toMatchObject({
        cause: error
      })
    })
  })

  describe('exists', () => {
    it('should return true if file exists', async () => {
      ;(fs.access as jest.Mock).mockResolvedValue(undefined)

      const result = await VideoStorage.exists(mockVideoId)
      expect(result).toBe(true)
    })

    it('should return false if file does not exist', async () => {
      ;(fs.access as jest.Mock).mockRejectedValue(new Error())

      const result = await VideoStorage.exists(mockVideoId)
      expect(result).toBe(false)
    })
  })

  describe('getFileSize', () => {
    it('should return file size', async () => {
      const mockSize = 1024
      ;(fs.stat as jest.Mock).mockResolvedValue({ size: mockSize })

      const result = await VideoStorage.getFileSize(mockVideoId)
      expect(result).toBe(mockSize)
    })

    it('should handle stat errors', async () => {
      const error = new Error('Permission denied')
      ;(fs.stat as jest.Mock).mockRejectedValue(error)

      await expect(VideoStorage.getFileSize(mockVideoId)).rejects.toThrow(StorageError)
      await expect(VideoStorage.getFileSize(mockVideoId)).rejects.toThrow('Failed to get file size')
      await expect(VideoStorage.getFileSize(mockVideoId)).rejects.toMatchObject({
        cause: error
      })
    })
  })

  describe('listVideos', () => {
    it('should list all videos with metadata', async () => {
      const mockFiles = ['video1', 'video2']
      const mockStats = {
        size: 1024,
        mtime: new Date(),
      }

      ;(fs.readdir as jest.Mock).mockResolvedValue(mockFiles)
      ;(fs.stat as jest.Mock).mockResolvedValue(mockStats)

      const result = await VideoStorage.listVideos()

      expect(result).toEqual([
        { id: 'video1', size: mockStats.size, createdAt: mockStats.mtime },
        { id: 'video2', size: mockStats.size, createdAt: mockStats.mtime },
      ])
    })

    it('should handle listing errors', async () => {
      const error = new Error('Permission denied')
      ;(fs.readdir as jest.Mock).mockRejectedValue(error)

      await expect(VideoStorage.listVideos()).rejects.toThrow(StorageError)
      await expect(VideoStorage.listVideos()).rejects.toThrow('Failed to list videos')
      await expect(VideoStorage.listVideos()).rejects.toMatchObject({
        cause: error
      })
    })
  })
})
