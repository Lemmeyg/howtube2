import { NextResponse } from 'next/server'
import { createServerActionSupabaseClient } from '@/lib/supabase/server'
import { ProcessingQueue } from '@/lib/video/queue'
import { logger } from '@/config/logger'
import { YtDlpDownloader } from '@/lib/video/yt-dlp'
import { VideoStorage } from '@/lib/video/storage'
import { AssemblyAI } from '@/lib/transcription/assemblyai'
import { extractAudio } from '@/lib/transcription/audio'
import { apiConfig } from '@/config/api'
import fs from 'fs/promises'
import path from 'path'

export async function POST() {
  let id: string | null = null
  let videoId: string | null = null
  let videoPath: string | null = null
  let audioPath: string | null = null

  try {
    const supabase = createServerActionSupabaseClient()
    const queue = new ProcessingQueue(supabase)

    const { data: queueEntry, error: queueError } = await supabase
      .from('video_processing')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (queueError || !queueEntry) {
      return NextResponse.json(
        { message: 'No pending videos to process', error: queueError },
        { status: 200 }
      )
    }

    id = queueEntry.id
    videoId = queueEntry.video_id
    const { video_url: videoUrl, user_id: userId } = queueEntry

    await queue.updateStatus(id, 'downloading', 0)
    logger.info(`Worker: Started downloading ${id}`)

    const downloader = new YtDlpDownloader()
    videoPath = await downloader.download(videoUrl, videoId, progress => {
      const numericPercentage = parseFloat(progress.percentage.toFixed(2))
      queue.updateStatus(id!, 'downloading', numericPercentage, {
        speed: progress.speed,
        eta: progress.eta,
        size: progress.size,
      })
    })

    logger.info(`Worker: Finished downloading ${id} to ${videoPath}`)
    await queue.updateStatus(id, 'downloaded', 100)

    logger.info(`Worker: Starting audio extraction for ${id}`)
    await queue.updateStatus(id, 'transcribing', 0, { current_step: 'audio_extraction' })

    audioPath = path.join('/tmp', `${videoId}.mp3`)
    await extractAudio(videoPath, audioPath)
    logger.info(`Worker: Audio extracted for ${id} to ${audioPath}`)

    await queue.updateStatus(id, 'transcribing', 25, { current_step: 'uploading_audio' })
    const audioUrl = await VideoStorage.uploadAudio(videoId, audioPath)
    logger.info(`Worker: Audio uploaded for ${id} to ${audioUrl}`)

    if (!apiConfig.assemblyAI.apiKey) {
      throw new Error('AssemblyAI API key is not configured')
    }
    const assemblyAI = new AssemblyAI(apiConfig.assemblyAI.apiKey)

    await queue.updateStatus(id, 'transcribing', 50, { current_step: 'submitting_transcription' })
    const transcriptionJob = await assemblyAI.submitTranscription(audioUrl, {
      language_code: 'en',
      punctuate: true,
      format_text: true,
      speaker_labels: true,
    })
    logger.info(`Worker: Transcription submitted for ${id}, job ID: ${transcriptionJob.id}`)

    const { error: transcriptionError } = await supabase.from('video_transcriptions').insert({
      video_id: videoId,
      processing_id: id,
      transcription_id: transcriptionJob.id,
      status: 'processing',
      user_id: userId,
    })

    if (transcriptionError) {
      logger.error('Worker: Failed to save transcription job ID', transcriptionError)
      throw new Error(`Failed to save transcription job ID: ${transcriptionError.message}`)
    }
    await queue.updateStatus(id, 'transcribing', 75, {
      current_step: 'transcription_pending',
      transcription_job_id: transcriptionJob.id,
    })
    logger.info(`Worker: Transcription job ID ${transcriptionJob.id} saved for ${id}`)

    await queue.updateStatus(id, 'completed', 100, { current_step: 'pipeline_complete' })
    logger.info(
      `Worker: Video ${id} processing pipeline complete. Transcription pending with AssemblyAI.`
    )

    return NextResponse.json({
      message: 'Video processing complete, transcription submitted',
      id,
      transcriptionId: transcriptionJob.id,
    })
  } catch (error: unknown) {
    logger.error(`Worker error for video ${id || 'unknown'}:`, error)
    let errorMessage = 'Unknown worker error'
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === 'string') {
      errorMessage = error
    }
    if (id) {
      const supabase = createServerActionSupabaseClient()
      const queue = new ProcessingQueue(supabase)
      await queue.updateStatus(id, 'failed', 0, { error: errorMessage, current_step: 'error' })
    }
    return NextResponse.json({ error: 'Worker failed', details: errorMessage }, { status: 500 })
  } finally {
    if (videoPath) {
      try {
        await fs.unlink(videoPath)
        logger.info(`Worker: Cleaned up video file ${videoPath}`)
      } catch (cleanupError) {
        logger.error(`Worker: Error cleaning up video file ${videoPath}:`, cleanupError)
      }
    }
    if (audioPath) {
      try {
        await fs.unlink(audioPath)
        logger.info(`Worker: Cleaned up audio file ${audioPath}`)
      } catch (cleanupError) {
        logger.error(`Worker: Error cleaning up audio file ${audioPath}:`, cleanupError)
      }
    }
  }
}
