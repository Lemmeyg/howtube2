console.log('route.ts loaded')
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { protectApi } from '@/lib/auth/protect-api'
import { AssemblyAI } from '@/lib/transcription/assemblyai'
import { extractAudio } from '@/lib/transcription/audio'
import { VideoStorage } from '@/lib/video/storage'
import { logger } from '@/config/logger'
import { apiConfig } from '@/config/api'

export async function POST(request: Request) {
  // throw new Error('FORCED ERROR: POST handler reached');
  return protectApi(async () => {
    try {
      console.log('POST handler: start')
      const cookieStore = cookies()
      console.log('POST handler: got cookieStore')
      const supabase = createServerClient(cookieStore)
      console.log('POST handler: got supabase')
      const {
        data: { session },
      } = await supabase.auth.getSession()
      console.log('POST handler: got session', session)

      if (!session?.user) {
        console.log('POST handler: no user in session')
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      // Parse request body
      const body = await request.json()
      console.log('POST handler: got body', body)
      const { videoId } = body

      if (!videoId) {
        console.log('POST handler: missing videoId')
        return NextResponse.json(
          { error: 'Video ID is required' },
          { status: 400 }
        )
      }

      // Extract audio from video
      const outputPath = `/tmp/${videoId}.mp3`
      await extractAudio(videoId, outputPath)
      console.log('POST handler: extracted audio')

      // Upload audio to temporary storage for AssemblyAI
      const audioUrl = await VideoStorage.uploadAudio(videoId, outputPath)
      console.log('POST handler: uploaded audio', audioUrl)

      // Initialize AssemblyAI client
      if (!apiConfig.assemblyAI.apiKey) {
        console.log('POST handler: missing AssemblyAI apiKey')
        throw new Error('AssemblyAI API key is not configured')
      }
      const assemblyAI = new AssemblyAI(apiConfig.assemblyAI.apiKey)
      console.log('POST handler: created AssemblyAI client')

      // Submit transcription
      const transcriptionId = await assemblyAI.submitTranscription(audioUrl, {
        language_code: 'en',
        punctuate: true,
        format_text: true,
        speaker_labels: true,
      })
      console.log('POST handler: submitted transcription', transcriptionId)

      // Store transcription ID in database
      const { error: dbError } = await supabase
        .from('video_transcriptions')
        .insert({
          video_id: videoId,
          transcription_id: transcriptionId,
          status: 'processing',
          user_id: session.user.id,
        })
      console.log('POST handler: inserted transcription row', dbError)

      if (dbError) throw dbError

      // Clean up temporary audio file
      await VideoStorage.deleteAudio(videoId)
      console.log('POST handler: deleted audio')

      return NextResponse.json({
        message: 'Transcription started',
        transcriptionId,
      })
    } catch (error) {
      console.log('POST handler error:', error)
      logger.error('Error transcribing video:', error)
      throw error
      return NextResponse.json(
        { error: 'Failed to transcribe video' },
        { status: 500 }
      )
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
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      // Get video ID from query params
      const { searchParams } = new URL(request.url)
      const videoId = searchParams.get('videoId')

      if (!videoId) {
        return NextResponse.json(
          { error: 'Video ID is required' },
          { status: 400 }
        )
      }

      // Get transcription record from database
      const { data: transcription, error: dbError } = await supabase
        .from('video_transcriptions')
        .select('*')
        .eq('video_id', videoId)
        .single()

      if (dbError) {
        if (dbError.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Transcription not found' },
            { status: 404 }
          )
        }
        throw dbError
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
            .eq('video_id', videoId)

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
      logger.error('Error getting transcription status:', error)
      return NextResponse.json(
        { error: 'Failed to get transcription status' },
        { status: 500 }
      )
    }
  })
} 