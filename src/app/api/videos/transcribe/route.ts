console.log('route.ts loaded')
import { NextResponse } from 'next/server'
import { createServerActionSupabaseClient } from '@/lib/supabase/server'
import { protectApi } from '@/lib/auth/protect-api'
import { AssemblyAI } from '@/lib/transcription/assemblyai'
import { logger } from '@/config/logger'
import { apiConfig } from '@/config/api'

export async function POST(request: Request) {
  return protectApi(async () => {
    try {
      logger.info('[Transcribe] Starting transcription request')
      const supabase = createServerActionSupabaseClient()

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        logger.warn('[Transcribe] Unauthorized request - no user session')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Parse request body
      const body = await request.json()
      logger.info('[Transcribe] Request body:', body)
      const id = body.id || body.videoId

      if (!id) {
        logger.warn('[Transcribe] Missing video ID in request')
        return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
      }

      // Look up the video_processing record to get video_id and video_url
      const { data: processing, error: procError } = await supabase
        .from('video_processing')
        .select('video_id, video_url')
        .eq('id', id)
        .single()

      if (procError || !processing) {
        logger.error('[Transcribe] Failed to fetch video processing record:', procError)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }

      // Initialize AssemblyAI client
      if (!apiConfig.assemblyAI.apiKey) {
        logger.error('[Transcribe] Missing AssemblyAI API key')
        throw new Error('AssemblyAI API key is not configured')
      }
      const assemblyAI = new AssemblyAI(apiConfig.assemblyAI.apiKey)

      // Submit transcription with YouTube URL
      logger.info(`[Transcribe] Submitting YouTube URL for transcription: ${processing.video_url}`)
      const transcriptionId = await assemblyAI.submitTranscription(processing.video_url, {
        language_code: 'en',
        punctuate: true,
        format_text: true,
        speaker_labels: true,
      })
      logger.info(`[Transcribe] Transcription submitted, job ID: ${transcriptionId}`)

      // Store transcription ID in database
      const { error: dbError } = await supabase.from('video_transcriptions').insert({
        video_id: processing.video_id,
        processing_id: id,
        transcription_id: transcriptionId,
        status: 'processing',
        user_id: session.user.id,
        video_url: processing.video_url,
      })

      if (dbError) {
        logger.error('[Transcribe] Failed to save transcription record:', dbError)
        throw dbError
      }

      logger.info('[Transcribe] Transcription process started successfully')
      return NextResponse.json({
        message: 'Transcription started',
        transcriptionId,
      })
    } catch (error) {
      logger.error('[Transcribe] Error processing request:', error)
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
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get id (UUID) from query params
      const { searchParams } = new URL(request.url)
      const id = searchParams.get('id') || searchParams.get('videoId')

      if (!id) {
        return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
      }

      // Look up the video_processing record to get video_id
      const { data: processing, error: procError } = await supabase
        .from('video_processing')
        .select('video_id')
        .eq('id', id)
        .single()
      if (procError || !processing) {
        return NextResponse.json({ error: 'Failed to get transcription status' }, { status: 500 })
      }
      // const videoId = processing.video_id // used for audio extraction and upload, but not returned

      // Get transcription record from database
      const { data: transcription, error: dbError } = await supabase
        .from('video_transcriptions')
        .select('*')
        .eq('processing_id', id)
        .single()

      if (dbError) {
        if (dbError.code === 'PGRST116') {
          return NextResponse.json({ error: 'Failed to get transcription status' }, { status: 500 })
        }
        throw dbError
      }
      if (!transcription) {
        return NextResponse.json({ error: 'Failed to get transcription status' }, { status: 500 })
      }

      // If transcription is still processing, check status
      if (transcription.status === 'processing') {
        if (!apiConfig.assemblyAI.apiKey) {
          throw new Error('AssemblyAI API key is not configured')
        }
        const assemblyAI = new AssemblyAI(apiConfig.assemblyAI.apiKey)
        const status = await assemblyAI.getTranscriptionStatus(transcription.transcription_id)

        // Update status if completed or failed
        if (status.status === 'completed' || status.status === 'error') {
          const { error: updateError } = await supabase
            .from('video_transcriptions')
            .update({
              status: status.status,
              text: status.text,
              words: status.words,
              error: status.error,
              completed_at: status.completed_at,
            })
            .eq('processing_id', id)

          if (updateError) throw updateError

          transcription.status = status.status
          transcription.text = status.text
          transcription.words = status.words
          transcription.error = status.error
          transcription.completed_at = status.completed_at
        }
      }

      return NextResponse.json(transcription)
    } catch (error) {
      logger.error('Error getting transcription:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}
