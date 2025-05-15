import { NextResponse } from 'next/server'
import { createServerActionSupabaseClient } from '@/lib/supabase/server'
import { protectApi } from '@/lib/auth/protect-api'
import { validateYouTubeUrl, extractYouTubeVideoId } from '@/lib/validation/youtube'
import { MetadataExtractor } from '@/lib/video/metadata'
import { logger } from '@/config/logger'
import { ProcessingQueue } from '@/lib/video/queue'

export async function POST(request: Request) {
  return protectApi(async () => {
    try {
      const supabase = createServerActionSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const body = await request.json()
      const { url } = body
      if (!url || !validateYouTubeUrl(url)) {
        return new NextResponse(JSON.stringify({ error: 'Invalid YouTube URL' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const videoId = extractYouTubeVideoId(url)
      if (!videoId) {
        return new NextResponse(JSON.stringify({ error: 'Could not extract video ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const metadataExtractor = new MetadataExtractor(supabase)
      const queue = new ProcessingQueue(supabase)
      // Check if video is already in queue
      const { data: existingData, error: existingError } = await supabase
        .from('video_processing')
        .select()
        .eq('video_id', videoId)
        .single()

      if ((existingError && existingError.code === 'PGRST116') || !existingData) {
        // No record found, proceed to insert
        const metadata = await metadataExtractor.extractMetadata(url)
        await metadataExtractor.saveMetadata(videoId, metadata)
        const { data: metadataRow } = await supabase
          .from('video_metadata')
          .select()
          .eq('video_id', videoId)
          .single()
        const queueItem = await queue.addToQueue(session.user.id, url, videoId)
        return new NextResponse(
          JSON.stringify({
            message: 'Video added to processing queue',
            status: queueItem,
            metadata: metadataRow,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // If the same user, same video, and status is 'pending', treat as idempotent
      if (
        existingData.user_id === session.user.id &&
        existingData.video_id === videoId &&
        existingData.status === 'pending'
      ) {
        const { data: metadataRow } = await supabase
          .from('video_metadata')
          .select()
          .eq('video_id', videoId)
          .single()
        return new NextResponse(
          JSON.stringify({
            message: 'Video added to processing queue',
            status: existingData,
            metadata: metadataRow,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // Otherwise, it's a true duplicate (different user or not pending)
      return new NextResponse(
        JSON.stringify({
          error: 'Video is already being processed',
          status: existingData,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      logger.error('Error processing video:', error)
      return new NextResponse(JSON.stringify({ error: 'Failed to process video' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  })
}

export async function GET(request: Request) {
  return protectApi(async () => {
    try {
      const supabase = createServerActionSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const { searchParams } = new URL(request.url)
      const videoId = searchParams.get('videoId') || searchParams.get('id')
      if (!videoId) {
        return new NextResponse(JSON.stringify({ error: 'Video ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const { data: status, error: statusError } = await supabase
        .from('video_processing')
        .select()
        .eq('video_id', videoId)
        .single()
      if ((statusError && statusError.code === 'PGRST116') || !status) {
        return new NextResponse(JSON.stringify({ error: 'Video not found in queue' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const { data: metadata } = await supabase
        .from('video_metadata')
        .select()
        .eq('video_id', videoId)
        .single()
      return new NextResponse(JSON.stringify({ status, metadata }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      logger.error('Error getting video status:', error)
      return new NextResponse(JSON.stringify({ error: 'Failed to get video status' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  })
}

export async function DELETE(request: Request) {
  return protectApi(async () => {
    try {
      const supabase = createServerActionSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const { searchParams } = new URL(request.url)
      const videoId = searchParams.get('videoId') || searchParams.get('id')
      if (!videoId) {
        return new NextResponse(JSON.stringify({ error: 'Video ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      // Check for existence first
      const { data: status, error: statusError } = await supabase
        .from('video_processing')
        .select()
        .eq('video_id', videoId)
        .single()
      if ((statusError && statusError.code === 'PGRST116') || !status) {
        return new NextResponse(JSON.stringify({ error: 'Video not found in queue' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      // Then check user
      if (status.user_id !== session.user.id) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      await Promise.all([
        supabase.from('video_processing').delete().eq('video_id', videoId),
        supabase.from('video_metadata').delete().eq('video_id', videoId),
      ])
      return new NextResponse(JSON.stringify({ message: 'Video removed from queue' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      logger.error('Error removing video:', error)
      return new NextResponse(JSON.stringify({ error: 'Failed to remove video' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  })
}
