import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { protectApi } from '@/lib/auth/protect-api'
import { validateYouTubeUrl, extractYouTubeVideoId } from '@/lib/validation/youtube'
import { ProcessingQueue } from '@/lib/video/queue'
import { MetadataExtractor } from '@/lib/video/metadata'
import { logger } from '@/config/logger'

export async function POST(request: Request) {
  return protectApi(async () => {
    try {
      const cookieStore = cookies()
      const supabase = createServerClient(cookieStore)
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Parse request body
      const body = await request.json()
      const { url } = body

      // Validate YouTube URL
      if (!url || !validateYouTubeUrl(url)) {
        return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })
      }

      // Extract video ID
      const videoId = extractYouTubeVideoId(url)
      if (!videoId) {
        return NextResponse.json({ error: 'Could not extract video ID' }, { status: 400 })
      }

      // Initialize queue and metadata extractor
      const queue = new ProcessingQueue(supabase)
      const metadataExtractor = new MetadataExtractor(supabase)

      // Check if video is already in queue
      const existingStatus = await queue.getStatus(videoId)
      if (existingStatus) {
        return NextResponse.json(
          { error: 'Video is already being processed', status: existingStatus },
          { status: 409 }
        )
      }

      // Extract metadata first
      const metadata = await metadataExtractor.extractMetadata(url)
      await metadataExtractor.saveMetadata(videoId, metadata)

      // Add to processing queue
      const queueItem = await queue.addToQueue(session.user.id, url, videoId)

      return NextResponse.json({
        message: 'Video added to processing queue',
        status: queueItem,
        metadata,
      })
    } catch (error) {
      logger.error('Error processing video:', error)
      return NextResponse.json({ error: 'Failed to process video' }, { status: 500 })
    }
  })
}

export async function GET(request: Request) {
  return protectApi(async () => {
    try {
      const cookieStore = cookies()
      const supabase = createServerClient(cookieStore)
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get video ID from query params
      const { searchParams } = new URL(request.url)
      const videoId = searchParams.get('videoId')

      if (!videoId) {
        return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
      }

      // Initialize queue and metadata extractor
      const queue = new ProcessingQueue(supabase)
      const metadataExtractor = new MetadataExtractor(supabase)

      // Get status and metadata
      const [status, metadata] = await Promise.all([
        queue.getStatus(videoId),
        metadataExtractor.getMetadata(videoId),
      ])

      if (!status) {
        return NextResponse.json({ error: 'Video not found in queue' }, { status: 404 })
      }

      return NextResponse.json({
        status,
        metadata,
      })
    } catch (error) {
      logger.error('Error getting video status:', error)
      return NextResponse.json({ error: 'Failed to get video status' }, { status: 500 })
    }
  })
}

export async function DELETE(request: Request) {
  return protectApi(async () => {
    try {
      const cookieStore = cookies()
      const supabase = createServerClient(cookieStore)
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get video ID from query params
      const { searchParams } = new URL(request.url)
      const videoId = searchParams.get('videoId')

      if (!videoId) {
        return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
      }

      // Initialize queue and metadata extractor
      const queue = new ProcessingQueue(supabase)
      const metadataExtractor = new MetadataExtractor(supabase)

      // Get current status to verify ownership
      const status = await queue.getStatus(videoId)
      if (!status) {
        return NextResponse.json({ error: 'Video not found in queue' }, { status: 404 })
      }

      // Verify ownership
      if (status.userId !== session.user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      // Remove from queue and delete metadata
      await Promise.all([queue.removeFromQueue(videoId), metadataExtractor.deleteMetadata(videoId)])

      return NextResponse.json({
        message: 'Video removed from queue',
      })
    } catch (error) {
      logger.error('Error removing video:', error)
      return NextResponse.json({ error: 'Failed to remove video' }, { status: 500 })
    }
  })
}
