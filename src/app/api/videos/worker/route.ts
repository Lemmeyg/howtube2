import { NextResponse } from 'next/server'
import { createServerActionSupabaseClient } from '@/lib/supabase/server'
import { logger } from '@/config/logger'
import { AssemblyAI } from '@/lib/transcription/assemblyai'
import { apiConfig } from '@/config/api'
import { sendStatusUpdate } from '../status/route'
import { YtDlp } from '@/lib/video/yt-dlp'
import path from 'path'
import { tmpdir } from 'os'
import { existsSync } from 'fs'
import fs from 'fs'

export async function POST(request: Request) {
  let id: string | null = null
  let videoId: string | null = null

  try {
    const supabase = createServerActionSupabaseClient()

    // Only process direct video processing requests
    const body = await request.json().catch(() => null)
    let queueEntry

    if (body?.videoId && body?.processingId) {
      logger.info(`[WORKER] Processing video ${body.videoId} (ID: ${body.processingId})`)
      const { data, error } = await supabase
        .from('video_processing')
        .select('*')
        .eq('id', body.processingId)
        .single()

      if (error) {
        logger.error(`[WORKER] Failed to fetch video processing entry: ${error.message}`)
        return NextResponse.json(
          { error: 'Failed to fetch video processing entry' },
          { status: 500 }
        )
      }
      queueEntry = data
    } else {
      logger.warn('[WORKER] No direct video specified. Worker will not poll for pending videos.')
      return NextResponse.json(
        { message: 'No direct video specified. Worker will not poll for pending videos.' },
        { status: 200 }
      )
    }

    id = queueEntry.id
    videoId = queueEntry.video_id
    const { video_url: videoUrl, user_id: userId } = queueEntry

    logger.info(`[WORKER] Starting download for video ${videoId}`)
    sendStatusUpdate(id!, {
      type: 'status',
      status: 'downloading',
      progress: 0,
      step: 'downloading_video',
    })

    // 1. Download the video using YtDlp
    const ytDlp = new YtDlp()
    let videoPath: string
    try {
      videoPath = await ytDlp.downloadVideo(videoUrl)
      logger.info(`[WORKER] Video downloaded to ${videoPath}`)
    } catch (err) {
      logger.error(`[WORKER] Failed to download video: ${err}`)
      sendStatusUpdate(id!, {
        type: 'status',
        status: 'error',
        progress: 0,
        step: 'error',
        error: 'Failed to download video',
      })
      throw err
    }

    sendStatusUpdate(id!, {
      type: 'status',
      status: 'extracting_audio',
      progress: 25,
      step: 'extracting_audio',
    })
    logger.info(`[WORKER] Starting audio extraction for video ${videoId}`)
    logger.info(`[WORKER] Video path: ${videoPath}`)

    // 2. Extract audio
    const audioFileName = `${videoId}.mp3`
    const audioPath = path.join(tmpdir(), 'howtube', audioFileName)
    logger.info(`[WORKER] Target audio path: ${audioPath}`)

    try {
      logger.info(`[WORKER] Importing audio extraction module`)
      const { extractAudio } = await import('@/lib/transcription/audio')
      logger.info(`[WORKER] Starting audio extraction process`)
      await extractAudio(videoPath, audioPath)
      logger.info(`[WORKER] Audio extraction completed successfully`)

      // Verify the audio file was created
      if (!existsSync(audioPath)) {
        throw new Error(`Audio file was not created at ${audioPath}`)
      }
      const stats = await fs.promises.stat(audioPath)
      logger.info(`[WORKER] Audio file created successfully (size: ${stats.size} bytes)`)
    } catch (err) {
      logger.error(`[WORKER] Failed to extract audio: ${err}`)
      sendStatusUpdate(id!, {
        type: 'status',
        status: 'error',
        progress: 0,
        step: 'error',
        error: 'Failed to extract audio',
      })
      throw err
    }

    // After audio extraction, before submitting to AssemblyAI
    logger.info(
      `[WORKER] Attempting to update video_processing status to 'transcribing' for id: ${id}`
    )
    const { data: transcribingData, error: transcribingError } = await supabase
      .from('video_processing')
      .update({ status: 'transcribing', progress: 50, step: 'transcription' })
      .eq('id', id)
      .select()
    if (transcribingError) {
      logger.error(
        `[WORKER] Failed to update video_processing status to 'transcribing': ${transcribingError.message}`
      )
    } else if (!transcribingData || transcribingData.length === 0) {
      logger.warn(`[WORKER] No rows updated in video_processing for id: ${id} (transcribing)`)
    } else {
      logger.info(`[WORKER] video_processing status updated to 'transcribing' for id: ${id}`)
    }

    sendStatusUpdate(id!, {
      type: 'status',
      status: 'transcribing',
      progress: 75,
      step: 'submitting_transcription',
    })
    logger.info(`[WORKER] Submitting audio to AssemblyAI for video ${videoId}`)

    if (!apiConfig.assemblyAI.apiKey) {
      logger.error('[WORKER] AssemblyAI API key is not configured')
      throw new Error('AssemblyAI API key is not configured')
    }
    const assemblyAI = new AssemblyAI(apiConfig.assemblyAI.apiKey)

    // Submit the local audio file directly to AssemblyAI
    logger.info(`[WORKER] Uploading audio file ${audioPath} to AssemblyAI`)
    const transcriptionJob = await assemblyAI.submitTranscription(audioPath, {
      language_code: 'en',
      punctuate: true,
      format_text: true,
      speaker_labels: true,
    })
    logger.info(`[WORKER] Transcription job submitted with ID: ${transcriptionJob}`)

    sendStatusUpdate(id!, {
      type: 'status',
      status: 'transcribing',
      progress: 80,
      step: 'transcription_submitted',
      transcription_job_id: transcriptionJob,
    })

    const { error: transcriptionError } = await supabase.from('video_transcriptions').insert({
      video_id: videoId,
      processing_id: id,
      transcription_id: transcriptionJob,
      status: 'processing',
      user_id: userId,
      video_url: videoUrl,
    })

    if (transcriptionError) {
      logger.error(`[WORKER] Failed to save transcription job ID: ${transcriptionError.message}`)
      throw new Error(`Failed to save transcription job ID: ${transcriptionError.message}`)
    }

    logger.info(`[WORKER] Starting to poll for transcription status (ID: ${transcriptionJob})`)

    // Start polling for transcription completion (as before, with status change guard)
    let attempts = 0
    const maxAttempts = 300 // 10 minutes with 2-second intervals
    const pollingInterval = 2000 // 2 seconds
    let lastStatus = ''

    while (attempts < maxAttempts) {
      const status = await assemblyAI.getTranscriptionStatus(transcriptionJob)

      if (status.status !== lastStatus) {
        lastStatus = status.status
        // Send status update only if changed
        sendStatusUpdate(id!, {
          type: 'status',
          status: status.status,
          progress: 80 + (attempts / maxAttempts) * 20,
          step: 'transcription_processing',
          transcription_job_id: transcriptionJob,
        })
        logger.info(`[WORKER] Transcription status changed: ${status.status}`)
      }

      if (status.status === 'completed') {
        try {
          // First update basic fields
          const { error: basicUpdateError } = await supabase
            .from('video_transcriptions')
            .update({
              status: 'completed',
              text: status.text,
              completed_at: status.completed_at,
            })
            .eq('processing_id', id)

          if (basicUpdateError) {
            logger.error(
              `[WORKER] Failed to update basic transcription fields: ${basicUpdateError.message}`
            )
            throw new Error(
              `Failed to update basic transcription fields: ${basicUpdateError.message}`
            )
          }

          // Then try to update words separately if they exist
          if (status.words) {
            try {
              const { error: wordsUpdateError } = await supabase
                .from('video_transcriptions')
                .update({ words: status.words })
                .eq('processing_id', id)

              if (wordsUpdateError) {
                logger.warn(`[WORKER] Could not update words field: ${wordsUpdateError.message}`)
                // Don't throw here, as the basic transcription is already saved
              }
            } catch (wordsError) {
              logger.warn(`[WORKER] Error updating words field:`, wordsError)
              // Don't throw here, as the basic transcription is already saved
            }
          }

          // Update video_processing status
          try {
            const { error: processingUpdateError } = await supabase
              .from('video_processing')
              .update({
                status: 'completed',
                progress: 100,
                step: 'pipeline_complete',
              })
              .eq('id', id)

            if (processingUpdateError) {
              logger.error(
                `[WORKER] Failed to update video_processing status: ${processingUpdateError.message}`
              )
              // Try updating without the step field as fallback
              const { error: fallbackError } = await supabase
                .from('video_processing')
                .update({
                  status: 'completed',
                  progress: 100,
                })
                .eq('id', id)

              if (fallbackError) {
                throw new Error(
                  `Failed to update video_processing status: ${fallbackError.message}`
                )
              }
            }
          } catch (error) {
            logger.error(`[WORKER] Error updating video_processing status:`, error)
            throw error
          }

          sendStatusUpdate(id!, {
            type: 'status',
            status: 'completed',
            progress: 100,
            step: 'pipeline_complete',
            transcription: {
              text: status.text,
              words: status.words,
            },
          })

          // After transcription is complete and saved to DB
          logger.info(`[WORKER] Processing complete for video ${videoId}`)
          return NextResponse.json({
            message: 'Video processing complete',
            id,
            transcriptionId: transcriptionJob,
          })
        } catch (error) {
          logger.error(`[WORKER] Failed to update transcription status:`, error)
          throw error
        }
      }

      if (status.status === 'error') {
        const error = `Transcription failed: ${status.error}`
        logger.error(`[WORKER] ${error}`)

        // Update database with error
        const { error: updateError } = await supabase
          .from('video_transcriptions')
          .update({
            status: 'error',
            error: status.error,
          })
          .eq('processing_id', id)

        if (updateError) {
          logger.error(`[WORKER] Failed to update transcription error: ${updateError.message}`)
        }

        sendStatusUpdate(id!, {
          type: 'status',
          status: 'error',
          progress: 0,
          step: 'error',
          error: status.error,
        })

        throw new Error(error)
      }

      await new Promise(resolve => setTimeout(resolve, pollingInterval))
      attempts++
    }

    throw new Error('Transcription timed out')
  } catch (error: unknown) {
    logger.error(`[WORKER] Fatal error processing video ${id || 'unknown'}:`, error)
    let errorMessage = 'Unknown worker error'
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === 'string') {
      errorMessage = error
    }
    if (id) {
      sendStatusUpdate(id!, {
        type: 'status',
        status: 'error',
        progress: 0,
        step: 'error',
        error: errorMessage,
      })
    }
    return NextResponse.json({ error: 'Worker failed', details: errorMessage }, { status: 500 })
  }
}
