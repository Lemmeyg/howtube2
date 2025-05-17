import { NextResponse } from 'next/server'
import { createServerActionSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/config/logger'
import { protectApi } from '@/lib/auth/protect-api'

// Get the base URL for the worker endpoint
const getWorkerUrl = () => {
  // In production, use the same origin
  if (process.env.NODE_ENV === 'production') {
    return '/api/videos/worker'
  }
  // In development, use localhost
  return 'http://localhost:3000/api/videos/worker'
}

export async function POST(request: Request) {
  try {
    const { videoId, videoUrl } = await request.json()
    logger.info(`[Video Submission] Starting submission for video ${videoId}`)

    const supabase = createServerActionSupabaseClient()

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      logger.error(`[Video Submission] Unauthorized: ${userError?.message}`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.info(`[Video Submission] User authenticated: ${user.id}`)

    // Insert the video into processing queue
    const { data: queueEntry, error: queueError } = await supabase
      .from('video_processing')
      .insert({
        video_id: videoId,
        video_url: videoUrl,
        user_id: user.id,
        status: 'pending',
      })
      .select()
      .single()

    if (queueError) {
      logger.error(`[Video Submission] Failed to queue video: ${queueError.message}`)
      return NextResponse.json({ error: 'Failed to queue video' }, { status: 500 })
    }
    logger.info(`[Video Submission] Video queued successfully with ID: ${queueEntry.id}`)

    // Trigger worker immediately
    try {
      const workerUrl = getWorkerUrl()
      logger.info(
        `[Video Submission] Attempting to trigger worker at ${workerUrl} for video ${videoId}`
      )

      const workerResponse = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId, processingId: queueEntry.id }),
      })

      if (!workerResponse.ok) {
        const errorText = await workerResponse.text()
        logger.error(`[Video Submission] Worker trigger failed: ${errorText}`)
        // Still return success to the user since the video is queued
      } else {
        const responseData = await workerResponse.json()
        logger.info(
          `[Video Submission] Worker triggered successfully for video ${videoId}:`,
          responseData
        )
      }
    } catch (workerError) {
      logger.error(
        `[Video Submission] Failed to trigger worker: ${workerError instanceof Error ? workerError.message : 'Unknown error'}`
      )
      // Don't fail the request if worker trigger fails
      // The video is still queued in the database
    }

    return NextResponse.json({
      message: 'Video queued for processing',
      id: queueEntry.id,
    })
  } catch (error) {
    logger.error(
      `[Video Submission] Failed to submit video: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    return NextResponse.json({ error: 'Failed to submit video' }, { status: 500 })
  }
}

export async function GET(_request: Request) {
  return protectApi(async () => {
    try {
      const supabase = createServerActionSupabaseClient()

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        logger.warn('[Videos] Unauthorized request - no user session')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { data: videos, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('[Videos] Failed to fetch videos:', error)
        return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 })
      }

      return NextResponse.json({ videos })
    } catch (error) {
      logger.error('[Videos] Error processing request:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}
