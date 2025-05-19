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
      logger.info('[Status] Starting status request')
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
      logger.info('[Status] Request params:', { id })

      if (!id) {
        logger.warn('[Status] Missing processing ID in request')
        return NextResponse.json({ error: 'Processing ID is required' }, { status: 400 })
      }

      const { data: processing, error: procError } = await supabase
        .from('video_processing')
        .select('*')
        .eq('id', id)
        .single()

      if (procError || !processing) {
        logger.error('[Status] Failed to fetch processing record:', procError)
        return NextResponse.json({ error: 'Processing record not found' }, { status: 404 })
      }

      logger.info('[Status] Found processing record:', processing)

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          const sendStatus = (status: StatusUpdate) => {
            logger.info('[Status] Sending status update:', status)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(status)}\n\n`))
          }

          // Send initial status
          sendStatus({
            id,
            type: 'status',
            status: processing.status,
            progress: processing.progress,
            step: processing.step,
            error: processing.error,
            transcription_job_id: processing.transcription_job_id,
            transcription: processing.transcription,
          })

          // Set up real-time updates
          const channel = supabase
            .channel(`processing-${id}`)
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'video_processing',
                filter: `id=eq.${id}`,
              },
              payload => {
                logger.info('[Status] Received real-time update:', payload)
                sendStatus({
                  id,
                  type: 'status',
                  status: payload.new.status,
                  progress: payload.new.progress,
                  step: payload.new.step,
                  error: payload.new.error,
                  transcription_job_id: payload.new.transcription_job_id,
                  transcription: payload.new.transcription,
                })
              }
            )
            .subscribe()

          // Clean up on close
          request.signal.addEventListener('abort', () => {
            logger.info('[Status] Client disconnected, cleaning up')
            channel.unsubscribe()
            controller.close()
          })
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
      logger.error('[Status] Error in status endpoint:', error)
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
