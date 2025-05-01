/**
 * Validates if a given URL is a valid YouTube video URL
 * Supports various YouTube URL formats:
 * - Standard: https://www.youtube.com/watch?v=VIDEO_ID
 * - Short: https://youtu.be/VIDEO_ID
 * - Embedded: https://www.youtube.com/embed/VIDEO_ID
 * - Mobile: https://m.youtube.com/watch?v=VIDEO_ID
 * - With additional parameters: https://www.youtube.com/watch?v=VIDEO_ID&feature=featured
 */
export function validateYouTubeUrl(url: string): boolean {
  if (!url) return false

  // Regular expression patterns for different YouTube URL formats
  const patterns = [
    // Standard YouTube URL
    /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?=.*v=([a-zA-Z0-9_-]{11}))(?:\S+)?$/,
    // Short YouTube URL
    /^(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:\S+)?$/,
    // Embedded YouTube URL
    /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(?:\S+)?$/,
    // Mobile YouTube URL
    /^(?:https?:\/\/)?(?:m\.)?youtube\.com\/watch\?(?=.*v=([a-zA-Z0-9_-]{11}))(?:\S+)?$/,
  ]

  // Test URL against all patterns
  return patterns.some(pattern => pattern.test(url))
}

/**
 * Extracts the video ID from a YouTube URL
 * Returns null if the URL is invalid
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!validateYouTubeUrl(url)) return null

  const patterns = [
    // Match standard and mobile YouTube URLs
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    // Match short YouTube URLs
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // Match embedded YouTube URLs
    /embed\/([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
} 