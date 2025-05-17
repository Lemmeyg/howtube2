import { NextResponse } from 'next/server'
import { createServerActionSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/config/logger'
import { protectApi } from '@/lib/auth/protect-api'

interface StatusUpdate {
  id: string
  type: 'status'
  status: string
  progress: number
  step: string
  error?: string
  transcription_job_id?: string
  transcription?: {
    text: string
    words?: unknown
  }
}

// Store active SSE connections
const connections = new Map<string, ReadableStreamController<Uint8Array>>()

export function sendStatusUpdate(id: string, data: StatusUpdate) {
  const controller = connections.get(id)
  if (controller) {
    const encoder = new TextEncoder()
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
  }
}

export async function GET(request: Request) {
  return protectApi(async () => {
    try {
      const supabase = createServerActionSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        logger.warn('[Status] Unauthorized request - no user session')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { searchParams } = new URL(request.url)
      const id = searchParams.get('id')

      if (!id) {
        logger.warn('[Status] Missing processing ID in request')
        return NextResponse.json({ error: 'Processing ID is required' }, { status: 400 })
      }

      // Check if user has access to this processing entry
      const { data: processing, error: processingError } = await supabase
        .from('video_processing')
        .select('*')
        .eq('id', id)
        .single()

      if (processingError || !processing) {
        logger.error('[Status] Failed to fetch processing entry:', processingError)
        return NextResponse.json({ error: 'Failed to fetch processing entry' }, { status: 500 })
      }

      if (processing.user_id !== session.user.id) {
        logger.warn('[Status] Unauthorized access attempt to processing entry:', id)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      // Create SSE response
      const stream = new ReadableStream({
        start(controller) {
          connections.set(id, controller)
          // Send initial status
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(processing)}\n\n`))
        },
        cancel() {
          connections.delete(id)
        },
      })

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    } catch (error) {
      logger.error('[Status] Error processing request:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}

export async function POST(request: Request) {
  return protectApi(async () => {
    try {
      const supabase = createServerActionSupabaseClient()
      const body = (await request.json()) as StatusUpdate
      const { id, status, progress, step, error, transcription_job_id, transcription } = body

      if (!id) {
        logger.warn('[Status] Missing processing ID in request')
        return NextResponse.json({ error: 'Processing ID is required' }, { status: 400 })
      }

      // Update processing status
      const { error: updateError } = await supabase
        .from('video_processing')
        .update({
          status,
          progress,
          step,
          error,
          transcription_job_id,
          transcription,
        })
        .eq('id', id)

      if (updateError) {
        logger.error('[Status] Failed to update status:', updateError)
        return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
      }

      return NextResponse.json({ message: 'Status updated' })
    } catch (error) {
      logger.error('[Status] Error processing request:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}
