import { NextResponse } from 'next/server'
import { createServerActionSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/config/logger'
import { protectApi } from '@/lib/auth/protect-api'

export async function POST(request: Request) {
  return protectApi(async () => {
    try {
      const supabase = createServerActionSupabaseClient()

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        logger.warn('[Video Submission] Unauthorized request - no user session')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Parse request body
      const body = await request.json()
      logger.info('[Video Submission] Request body:', body)
      const videoId = body.videoId
      const videoUrl = body.url

      if (!videoId || !videoUrl) {
        logger.warn('[Video Submission] Missing video ID or URL in request')
        return NextResponse.json({ error: 'Video ID and URL are required' }, { status: 400 })
      }

      // Check if video is already in queue
      const { data: existing } = await supabase
        .from('video_processing')
        .select('id')
        .eq('video_id', videoId)
        .single()

      if (existing) {
        logger.info(`[Video Submission] Video already in queue with ID: ${existing.id}`)
        return NextResponse.json({
          message: 'Video already in queue',
          id: existing.id,
        })
      }

      // Check for existing transcription by URL first
      const { data: existingTranscriptionByUrl } = await supabase
        .from('video_transcriptions')
        .select('*')
        .eq('video_url', videoUrl)
        .single()

      if (existingTranscriptionByUrl) {
        logger.info(`[Video Submission] Found existing transcription by URL for ${videoUrl}`)
        // Insert new processing entry as completed (reuse transcription)
        const { data: processing, error: processingError } = await supabase
          .from('video_processing')
          .insert({
            video_id: videoId,
            video_url: videoUrl,
            user_id: session.user.id,
            status: 'completed',
            progress: 100,
            step: 'transcription',
          })
          .select()
          .single()

        if (processingError || !processing) {
          logger.error(
            '[Video Submission] Failed to create processing entry (reuse):',
            processingError
          )
          return NextResponse.json({ error: 'Failed to queue video (reuse)' }, { status: 500 })
        }

        // Insert new video_transcriptions record for this processing
        const { error: transcriptionInsertError } = await supabase
          .from('video_transcriptions')
          .insert({
            video_id: videoId,
            processing_id: processing.id,
            transcription_id: existingTranscriptionByUrl.transcription_id,
            status: existingTranscriptionByUrl.status,
            text: existingTranscriptionByUrl.text,
            words: existingTranscriptionByUrl.words,
            video_url: videoUrl,
            user_id: session.user.id,
          })

        if (transcriptionInsertError) {
          logger.error(
            '[Video Submission] Failed to insert reused transcription:',
            transcriptionInsertError
          )
          return NextResponse.json({ error: 'Failed to reuse transcription' }, { status: 500 })
        }

        logger.info(
          `[Video Submission] Transcription reused for video ${videoId}, processing ID: ${processing.id}`
        )
        return NextResponse.json({
          message: 'Transcription reused for video',
          id: processing.id,
          reusedTranscription: true,
        })
      }

      // Check for existing transcription by video_id as fallback
      const { data: existingTranscriptionById } = await supabase
        .from('video_transcriptions')
        .select('*')
        .eq('video_id', videoId)
        .single()

      if (existingTranscriptionById) {
        // Insert new processing entry as completed (reuse transcription)
        const { data: processing, error: processingError } = await supabase
          .from('video_processing')
          .insert({
            video_id: videoId,
            video_url: body.url,
            user_id: session.user.id,
            status: 'completed',
            progress: 100,
            step: 'transcription',
          })
          .select()
          .single()

        if (processingError || !processing) {
          logger.error(
            '[Video Submission] Failed to create processing entry (reuse):',
            processingError
          )
          return NextResponse.json({ error: 'Failed to queue video (reuse)' }, { status: 500 })
        }

        // Insert new video_transcriptions record for this processing
        const { error: transcriptionInsertError } = await supabase
          .from('video_transcriptions')
          .insert({
            video_id: videoId,
            processing_id: processing.id,
            transcription_id: existingTranscriptionById.transcription_id,
            status: existingTranscriptionById.status,
            text: existingTranscriptionById.text,
            user_id: session.user.id,
          })

        if (transcriptionInsertError) {
          logger.error(
            '[Video Submission] Failed to insert reused transcription:',
            transcriptionInsertError
          )
          return NextResponse.json({ error: 'Failed to reuse transcription' }, { status: 500 })
        }

        logger.info(
          `[Video Submission] Transcription reused for video ${videoId}, processing ID: ${processing.id}`
        )
        return NextResponse.json({
          message: 'Transcription reused for video',
          id: processing.id,
          reusedTranscription: true,
        })
      }

      // Create new processing entry
      const { data: processing, error: processingError } = await supabase
        .from('video_processing')
        .insert({
          video_id: videoId,
          video_url: body.url,
          user_id: session.user.id,
          status: 'pending',
        })
        .select()
        .single()

      if (processingError || !processing) {
        logger.error('[Video Submission] Failed to create processing entry:', processingError)
        return NextResponse.json({ error: 'Failed to queue video' }, { status: 500 })
      }

      logger.info(`[Video Submission] Video queued successfully with ID: ${processing.id}`)

      // Trigger worker
      try {
        logger.info(
          `[Video Submission] Attempting to trigger worker at http://localhost:3000/api/videos/worker for video ${videoId}`
        )
        const response = await fetch('http://localhost:3000/api/videos/worker', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            videoId,
            processingId: processing.id,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          logger.error('[Video Submission] Worker trigger failed:', error)
          return NextResponse.json({ error: 'Failed to start processing' }, { status: 500 })
        }
      } catch (error) {
        logger.error('[Video Submission] Worker trigger failed:', error)
        return NextResponse.json({ error: 'Failed to start processing' }, { status: 500 })
      }

      return NextResponse.json({
        message: 'Video queued for processing',
        id: processing.id,
      })
    } catch (error) {
      logger.error('[Video Submission] Error processing request:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
