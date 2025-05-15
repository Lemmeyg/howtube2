import { MetadataExtractor, VideoMetadata } from '../metadata'
import { YtDlp } from '../yt-dlp'
import { SupabaseClient } from '@supabase/supabase-js'
import { PostgrestSingleResponse, PostgrestError } from '@supabase/postgrest-js'

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
    upload_date: '20240321',
    uploader: 'Test Channel',
    uploader_url: 'https://youtube.com/channel/test',
    view_count: 1000,
    like_count: 100,
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

  type VideoMetadataRow = { video_id: string } & Omit<VideoMetadata, 'id'>

  const createPostgrestError = (code: string, message: string): PostgrestError => ({
    code,
    message,
    details: '',
    hint: '',
    name: 'PostgrestError',
  })

  const mockSuccessResponse = <T>(data: T): PostgrestSingleResponse<T> => ({
    data,
    error: null,
    count: null,
    status: 200,
    statusText: 'OK',
  })

  // const mockEmptyResponse = (): PostgrestResponse<null> => ({
  //   data: null,
  //   error: createPostgrestError('', ''),
  //   count: null,
  //   status: 200,
  //   statusText: 'OK',
  // })

  const mockErrorResponse = (error: Partial<PostgrestError>): PostgrestSingleResponse<null> => ({
    data: null,
    error: createPostgrestError(error.code || '', error.message || ''),
    count: null,
    status: 400,
    statusText: 'Bad Request',
  })

  const createMockSupabase = () => {
    const mockFrom = jest.fn().mockReturnValue({
      insert: jest.fn().mockImplementation(() => Promise.resolve(mockSuccessResponse(null))),
      select: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            mockSuccessResponse<VideoMetadataRow>({ video_id: mockVideoId, ...mockMetadata })
          )
        ),
    })

    return {
      from: mockFrom,
    } as unknown as SupabaseClient
  }

  interface DownloadProgress {
    percentage: number
    speed: string
    eta: string
    size: string
  }

  const createMockYtDlp = (metadata: Promise<unknown>) => {
    const mockInstance = {
      getVideoMetadata: jest.fn().mockImplementation(() => metadata),
      downloadVideo: jest
        .fn()
        .mockImplementation((url: string, onProgress?: (progress: DownloadProgress) => void) => {
          if (onProgress) {
            onProgress({
              percentage: 100,
              speed: '1MB/s',
              eta: '0s',
              size: '10MB',
            })
          }
          return Promise.resolve('/path/to/video')
        }),
    }

    // Add private parseProgress method
    Object.defineProperty(mockInstance, 'parseProgress', {
      value: jest.fn().mockImplementation((_output: string): DownloadProgress | null => {
        return {
          percentage: 100,
          speed: '1MB/s',
          eta: '0s',
          size: '10MB',
        }
      }),
      enumerable: false,
      configurable: true,
      writable: true,
    })

    return mockInstance as unknown as YtDlp
  }

  let mockSupabase: SupabaseClient
  let extractor: MetadataExtractor
  let mockYtDlpInstance: ReturnType<typeof createMockYtDlp>

  beforeEach(() => {
    jest.clearAllMocks()
    mockYtDlpInstance = createMockYtDlp(Promise.resolve(mockYtDlpMetadata))
    jest.mocked(YtDlp).mockImplementation(() => mockYtDlpInstance)
    mockSupabase = createMockSupabase()
    extractor = new MetadataExtractor(mockSupabase)
  })

  describe('extractMetadata', () => {
    it('should extract metadata from YouTube URL', async () => {
      const result = await extractor.extractMetadata(mockUrl)
      expect(result).toEqual(mockMetadata)
      expect(mockYtDlpInstance.getVideoMetadata).toHaveBeenCalledWith(mockUrl)
    })

    it('should handle extraction errors', async () => {
      const error = new Error('Extraction failed')
      const mockYtDlp = createMockYtDlp(Promise.reject(error))
      jest.mocked(YtDlp).mockImplementation(() => mockYtDlp)
      extractor = new MetadataExtractor(mockSupabase)

      await expect(extractor.extractMetadata(mockUrl)).rejects.toThrow(
        'Failed to extract video metadata'
      )
    })
  })

  describe('saveMetadata', () => {
    it('should save metadata to database', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        upsert: jest.fn().mockImplementation(() => Promise.resolve(mockSuccessResponse(null))),
      })
      mockSupabase.from = mockFrom
      extractor = new MetadataExtractor(mockSupabase)

      await extractor.saveMetadata(mockVideoId, mockMetadata)
      expect(mockSupabase.from).toHaveBeenCalledWith('video_metadata')
      expect(mockSupabase.from('video_metadata').upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          video_id: mockVideoId,
          title: mockMetadata.title,
          description: mockMetadata.description,
        }),
        { onConflict: 'video_id' }
      )
    })

    it('should handle database errors', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        upsert: jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve(mockErrorResponse({ code: 'PGRST409', message: 'Database error' }))
          ),
      })
      mockSupabase.from = mockFrom
      extractor = new MetadataExtractor(mockSupabase)

      await expect(extractor.saveMetadata(mockVideoId, mockMetadata)).rejects.toThrow(
        'Failed to save video metadata'
      )
    })
  })

  describe('getMetadata', () => {
    it('should get metadata from database', async () => {
      const result = await extractor.getMetadataById(mockVideoId)
      expect(result).toEqual(mockMetadata)
      expect(mockSupabase.from).toHaveBeenCalledWith('video_metadata')
      expect(mockSupabase.from('video_metadata').select).toHaveBeenCalled()
      expect(mockSupabase.from('video_metadata').select().eq).toHaveBeenCalledWith(
        'video_id',
        mockVideoId
      )
    })

    it('should return null for non-existent video', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve(mockErrorResponse({ code: 'PGRST116', message: 'Record not found' }))
          ),
      })
      mockSupabase.from = mockFrom
      extractor = new MetadataExtractor(mockSupabase)

      const result = await extractor.getMetadataById(mockVideoId)
      expect(result).toBeNull()
    })
  })

  describe('deleteMetadata', () => {
    it('should delete metadata from database', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation(() => Promise.resolve(mockSuccessResponse(null))),
      })
      mockSupabase.from = mockFrom
      extractor = new MetadataExtractor(mockSupabase)

      await extractor.deleteMetadataById(mockVideoId)
      expect(mockSupabase.from).toHaveBeenCalledWith('video_metadata')
      expect(mockSupabase.from('video_metadata').delete).toHaveBeenCalled()
      expect(mockSupabase.from('video_metadata').delete().eq).toHaveBeenCalledWith(
        'video_id',
        mockVideoId
      )
    })

    it('should handle deletion errors', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve(mockErrorResponse({ code: 'PGRST409', message: 'Database error' }))
          ),
      })
      mockSupabase.from = mockFrom
      extractor = new MetadataExtractor(mockSupabase)

      await expect(extractor.deleteMetadataById(mockVideoId)).rejects.toThrow(
        'Failed to delete video metadata'
      )
    })
  })
})
