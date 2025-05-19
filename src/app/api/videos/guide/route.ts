import { NextResponse } from 'next/server'
import { createServerActionSupabaseClient } from '@/lib/supabase/server'
import { protectApi } from '@/lib/auth/protect-api'
import { GuideGenerator } from '@/lib/guide/openai'
import { GuideStorage } from '@/lib/guide/storage'
import { logger } from '@/config/logger'
import { apiConfig } from '@/config/api'

export async function POST(request: Request) {
  return protectApi(async () => {
    try {
      logger.info('[Guide] Starting guide generation request')
      const supabase = createServerActionSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) {
        logger.warn('[Guide] Unauthorized request - no user session')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const body = await request.json()
      const id = body.id || body.videoId
      const config = body.config
      logger.info('[Guide] Request body:', { id, config })

      if (!id) {
        logger.warn('[Guide] Missing video ID in request')
        return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
      }

      const { data: processing, error: procError } = await supabase
        .from('video_processing')
        .select('video_id')
        .eq('id', id)
        .single()

      if (procError || !processing) {
        logger.error('[Guide] Failed to fetch video processing record:', procError)
        return NextResponse.json({ error: 'Video not found in queue' }, { status: 404 })
      }

      const videoId = processing.video_id
      logger.info('[Guide] Found video ID:', videoId)

      const { data: transcription, error: transcriptionError } = await supabase
        .from('video_transcriptions')
        .select('*')
        .eq('processing_id', id)
        .single()

      if (transcriptionError) {
        logger.error('[Guide] Failed to fetch transcription:', transcriptionError)
        if (transcriptionError.code === 'PGRST116') {
          return NextResponse.json({ error: 'Failed to generate guide' }, { status: 500 })
        }
        throw transcriptionError
      }

      if (!transcription) {
        logger.error('[Guide] No transcription found for processing ID:', id)
        return NextResponse.json({ error: 'Failed to generate guide' }, { status: 500 })
      }

      if (transcription.status !== 'completed') {
        logger.warn('[Guide] Transcription not completed:', transcription.status)
        return NextResponse.json({ error: 'Transcription is not completed' }, { status: 400 })
      }

      logger.info('[Guide] Creating guide record')
      const guideStorage = new GuideStorage(supabase)
      const { id: guideId } = await guideStorage.createGuide(videoId, session.user.id)

      if (!apiConfig.openAI.apiKey) {
        logger.error('[Guide] OpenAI API key not configured')
        throw new Error('OpenAI API key is not configured')
      }

      logger.info('[Guide] Starting guide generation with OpenAI')
      const guideGenerator = new GuideGenerator(apiConfig.openAI.apiKey)
      try {
        const guide = await guideGenerator.generateGuide(
          transcription.text,
          transcription.words,
          config
        )
        logger.info('[Guide] Guide generated successfully')

        await guideStorage.updateGuide(guideId, guide)
        logger.info('[Guide] Guide stored in database')

        return NextResponse.json({
          message: 'Guide generated successfully',
          guideId,
        })
      } catch (error) {
        logger.error('[Guide] Error generating guide:', error)
        await guideStorage.markGuideError(
          guideId,
          error instanceof Error ? error.message : 'Unknown error'
        )
        throw error
      }
    } catch (error) {
      logger.error('[Guide] Error in guide generation:', error)
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
      const { searchParams } = new URL(request.url)
      const guideId = searchParams.get('guideId')
      const videoId = searchParams.get('videoId') || searchParams.get('id')
      if (!guideId && !videoId) {
        return NextResponse.json({ error: 'Guide ID or Video ID is required' }, { status: 400 })
      }
      const guideStorage = new GuideStorage(supabase)
      if (guideId) {
        const metadata = await guideStorage.getGuideMetadata(guideId)
        if (!metadata) {
          return NextResponse.json([], { status: 200 })
        }
        const content = await guideStorage.getGuideContent(guideId)
        return NextResponse.json({
          ...metadata,
          sections: content.sections,
        })
      } else {
        const guides = await guideStorage.listGuides(session.user.id, videoId ?? undefined)
        return NextResponse.json(guides, { status: 200 })
      }
    } catch (error) {
      logger.error('Error getting guide:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const { searchParams } = new URL(request.url)
      const guideId = searchParams.get('guideId')
      const videoId = searchParams.get('videoId')
      if (!guideId && !videoId) {
        return NextResponse.json({ error: 'Guide ID is required' }, { status: 400 })
      }
      const guideStorage = new GuideStorage(supabase)
      let metadata
      if (guideId) {
        metadata = await guideStorage.getGuideMetadata(guideId)
      } else {
        const guides = await guideStorage.listGuides(session.user.id, videoId ?? undefined)
        metadata = guides && guides.length > 0 ? guides[0] : null
      }
      if (!metadata) {
        return NextResponse.json({ error: 'Guide ID is required' }, { status: 400 })
      }
      if (metadata.userId !== session.user.id) {
        return NextResponse.json({ error: 'Guide ID is required' }, { status: 400 })
      }
      await guideStorage.deleteGuide(metadata.id)
      return NextResponse.json({
        message: 'Guide deleted successfully',
      })
    } catch (error) {
      logger.error('Error deleting guide:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}
