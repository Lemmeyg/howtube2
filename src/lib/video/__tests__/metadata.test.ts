import { MetadataExtractor, VideoMetadata } from '../metadata'
import { YtDlp } from '../yt-dlp'
import { SupabaseClient } from '@supabase/supabase-js'

// Mock dependencies
jest.mock('../yt-dlp')
jest.mock('@/config/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}))

describe('MetadataExtractor', () => {
  const mockVideoId = 'test-video-123'
  const mockUrl = 'https://www.youtube.com/watch?v=test123'
  const mockMetadata: VideoMetadata = {
    id: mockVideoId,
    title: 'Test Video',
    description: 'Test Description',
    duration: 180,
    thumbnail: 'https://example.com/thumb.jpg',
    formats: [
      {
        formatId: '22',
        ext: 'mp4',
        filesize: 1000000,
        acodec: 'aac',
        vcodec: 'h264',
      },
    ],
    uploadDate: '20240321',
    uploader: 'Test Channel',
    uploaderUrl: 'https://youtube.com/channel/test',
    viewCount: 1000,
    likeCount: 100,
    tags: ['test', 'video'],
  }

  const mockYtDlpMetadata = {
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
    upload_date: '20240321',
    uploader: 'Test Channel',
    uploader_url: 'https://youtube.com/channel/test',
    view_count: 1000,
    like_count: 100,
    tags: ['test', 'video'],
  }

  const mockSupabase = {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ error: null })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: mockMetadata, error: null })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null })),
      })),
    })),
  } as unknown as SupabaseClient

  let extractor: MetadataExtractor

  beforeEach(() => {
    jest.clearAllMocks()
    extractor = new MetadataExtractor(mockSupabase)
    ;(YtDlp.getVideoMetadata as jest.Mock).mockResolvedValue(mockYtDlpMetadata)
  })

  describe('extractMetadata', () => {
    it('should extract metadata from YouTube URL', async () => {
      const result = await extractor.extractMetadata(mockUrl)
      expect(result).toEqual(mockMetadata)
      expect(YtDlp.getVideoMetadata).toHaveBeenCalledWith(mockUrl)
    })

    it('should handle extraction errors', async () => {
      ;(YtDlp.getVideoMetadata as jest.Mock).mockRejectedValue(new Error('Extraction failed'))

      await expect(extractor.extractMetadata(mockUrl)).rejects.toThrow(
        'Failed to extract video metadata'
      )
    })
  })

  describe('saveMetadata', () => {
    it('should save metadata to database', async () => {
      await extractor.saveMetadata(mockVideoId, mockMetadata)
      expect(mockSupabase.from).toHaveBeenCalledWith('video_metadata')
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          video_id: mockVideoId,
          title: mockMetadata.title,
          description: mockMetadata.description,
        })
      )
    })

    it('should handle database errors', async () => {
      mockSupabase.from().insert.mockImplementationOnce(() => ({
        error: new Error('Database error'),
      }))

      await expect(extractor.saveMetadata(mockVideoId, mockMetadata)).rejects.toThrow(
        'Failed to save video metadata'
      )
    })
  })

  describe('getMetadata', () => {
    it('should get metadata from database', async () => {
      const result = await extractor.getMetadata(mockVideoId)
      expect(result).toEqual(mockMetadata)
      expect(mockSupabase.from().select().eq).toHaveBeenCalledWith('video_id', mockVideoId)
    })

    it('should return null for non-existent video', async () => {
      mockSupabase
        .from()
        .select()
        .eq()
        .single.mockImplementationOnce(() => ({
          data: null,
          error: { code: 'PGRST116' },
        }))

      const result = await extractor.getMetadata(mockVideoId)
      expect(result).toBeNull()
    })
  })

  describe('deleteMetadata', () => {
    it('should delete metadata from database', async () => {
      await extractor.deleteMetadata(mockVideoId)
      expect(mockSupabase.from().delete().eq).toHaveBeenCalledWith('video_id', mockVideoId)
    })

    it('should handle deletion errors', async () => {
      mockSupabase
        .from()
        .delete()
        .eq.mockImplementationOnce(() => ({
          error: new Error('Database error'),
        }))

      await expect(extractor.deleteMetadata(mockVideoId)).rejects.toThrow(
        'Failed to delete video metadata'
      )
    })
  })
})
