import { validateYouTubeUrl, extractYouTubeVideoId } from '../youtube'

describe('YouTube URL Validation', () => {
  describe('validateYouTubeUrl', () => {
    const validUrls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    ]

    const invalidUrls = [
      'https://youtube.com/watch?v=tooooooLongggg',
      'https://youtube.com/watch?v=abc',
      'https://youtube.com/watch',
      'https://youtube.com',
      'https://youtu.be/',
      'https://youtube.com/embed',
      'https://vimeo.com/123456789',
      'not a url',
      '',
    ]

    test.each(validUrls)('should accept valid YouTube URL: %s', (url) => {
      expect(validateYouTubeUrl(url)).toBe(true)
    })

    test.each(invalidUrls)('should reject invalid YouTube URL: %s', (url) => {
      expect(validateYouTubeUrl(url)).toBe(false)
    })
  })

  describe('extractYouTubeVideoId', () => {
    const urlsWithIds = [
      {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        expectedId: 'dQw4w9WgXcQ',
      },
      {
        url: 'https://youtu.be/dQw4w9WgXcQ',
        expectedId: 'dQw4w9WgXcQ',
      },
      {
        url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        expectedId: 'dQw4w9WgXcQ',
      },
      {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=featured',
        expectedId: 'dQw4w9WgXcQ',
      },
    ]

    const invalidUrls = [
      '',
      'https://youtube.com',
      'https://vimeo.com/123456789',
      'not-a-url',
    ]

    test.each(urlsWithIds)(
      'should extract video ID from URL: $url',
      ({ url, expectedId }) => {
        expect(extractYouTubeVideoId(url)).toBe(expectedId)
      }
    )

    test.each(invalidUrls)(
      'should return null for invalid URL: %s',
      (url) => {
        expect(extractYouTubeVideoId(url)).toBeNull()
      }
    )
  })
}) 