import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { protectApi } from '@/lib/auth/protect-api'
import { GuideGenerator } from '@/lib/guide/openai'
import { GuideStorage } from '@/lib/guide/storage'
import { logger } from '@/config/logger'
import { apiConfig } from '@/config/api'

export async function POST(request: Request) {
  return protectApi(async () => {
    try {
      const cookieStore = cookies()
      const supabase = createServerClient(cookieStore)
      const {
        data: { session },
      } = await supabase.auth.getSession()
      console.log('POST handler: got session', session)

      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Parse request body
      const body = await request.json()
      console.log('POST handler: got body', body)
      const { videoId, config } = body

      if (!videoId) {
        return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
      }

      // Get transcription
      const { data: transcription, error: transcriptionError } = await supabase
        .from('video_transcriptions')
        .select('*')
        .eq('video_id', videoId)
        .single()
      console.log('POST handler: got transcription', transcription, transcriptionError)

      if (transcriptionError) {
        if (transcriptionError.code === 'PGRST116') {
          return NextResponse.json({ error: 'Transcription not found' }, { status: 404 })
        }
        throw transcriptionError
      }

      if (!transcription) {
        throw new Error('Transcription is null')
      }

      if (transcription.status !== 'completed') {
        return NextResponse.json({ error: 'Transcription is not completed' }, { status: 400 })
      }

      // Create guide storage entry
      const guideStorage = new GuideStorage(supabase)
      const { id: guideId } = await guideStorage.createGuide(videoId, session.user.id)
      console.log('POST handler: created guideId', guideId)

      // Generate guide
      if (!apiConfig.openAI.apiKey) {
        throw new Error('OpenAI API key is not configured')
      }
      const guideGenerator = new GuideGenerator(apiConfig.openAI.apiKey)

      try {
        const guide = await guideGenerator.generateGuide(
          transcription.text,
          transcription.words,
          config
        )
        console.log('POST handler: generated guide', guide)

        // Store guide
        await guideStorage.updateGuide(guideId, guide)
        console.log('POST handler: updated guide')

        console.log('POST handler: success')
        return NextResponse.json({
          message: 'Guide generated successfully',
          guideId,
        })
      } catch (error) {
        await guideStorage.markGuideError(
          guideId,
          error instanceof Error ? error.message : 'Unknown error'
        )
        console.log('POST handler: error in guide generation', error)
        throw error
      }
    } catch (error) {
      logger.error('Error generating guide:', error)
      return NextResponse.json({ error: 'Failed to generate guide' }, { status: 500 })
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
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get guide ID from query params
      const { searchParams } = new URL(request.url)
      const guideId = searchParams.get('guideId')
      const videoId = searchParams.get('videoId')

      if (!guideId && !videoId) {
        return NextResponse.json({ error: 'Guide ID or Video ID is required' }, { status: 400 })
      }

      const guideStorage = new GuideStorage(supabase)

      if (guideId) {
        // Get specific guide
        const metadata = await guideStorage.getGuideMetadata(guideId)
        const content = await guideStorage.getGuideContent(guideId)

        console.log('GET handler returning:', { ...metadata, sections: content?.sections })
        return NextResponse.json({
          ...metadata,
          sections: content.sections,
        })
      } else {
        // List guides for video
        const guides = await guideStorage.listGuides(session.user.id, videoId ?? undefined)
        console.log('GET handler returning:', guides)
        return NextResponse.json(guides)
      }
    } catch (error) {
      logger.error('Error getting guide:', error)
      return NextResponse.json({ error: 'Failed to get guide' }, { status: 500 })
    }
  })
}

export async function DELETE(request: Request) {
  return protectApi(async () => {
    try {
      const cookieStore = cookies()
      const supabase = createServerClient(cookieStore)
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get guide ID from query params
      const { searchParams } = new URL(request.url)
      const guideId = searchParams.get('guideId')

      if (!guideId) {
        return NextResponse.json({ error: 'Guide ID is required' }, { status: 400 })
      }

      const guideStorage = new GuideStorage(supabase)

      // Verify ownership
      const metadata = await guideStorage.getGuideMetadata(guideId)
      if (metadata.userId !== session.user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      // Delete guide
      await guideStorage.deleteGuide(guideId)

      return NextResponse.json({
        message: 'Guide deleted successfully',
      })
    } catch (error) {
      logger.error('Error deleting guide:', error)
      return NextResponse.json({ error: 'Failed to delete guide' }, { status: 500 })
    }
  })
}
