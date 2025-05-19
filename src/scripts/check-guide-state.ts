import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkGuideState() {
  const videoId = 'agpNZENkD2U'

  console.log('Checking video processing state...')
  const { data: processing, error: procError } = await supabase
    .from('video_processing')
    .select('*')
    .eq('video_id', videoId)
    .single()

  if (procError) {
    console.error('Error fetching video processing:', procError)
    return
  }

  console.log('Video processing state:', processing)

  if (processing) {
    console.log('\nChecking transcription state...')
    const { data: transcription, error: transError } = await supabase
      .from('video_transcriptions')
      .select('*')
      .eq('processing_id', processing.id)
      .single()

    if (transError) {
      console.error('Error fetching transcription:', transError)
      return
    }

    console.log('Transcription state:', transcription)

    if (transcription) {
      console.log('\nChecking guide state...')
      const { data: guide, error: guideError } = await supabase
        .from('guides')
        .select('*')
        .eq('video_id', videoId)
        .single()

      if (guideError) {
        console.error('Error fetching guide:', guideError)
        return
      }

      console.log('Guide state:', guide)

      if (guide) {
        console.log('\nChecking guide sections...')
        const { data: sections, error: sectionsError } = await supabase
          .from('guide_sections')
          .select('*')
          .eq('guide_id', guide.id)
          .order('section_order', { ascending: true })

        if (sectionsError) {
          console.error('Error fetching guide sections:', sectionsError)
          return
        }

        console.log('Guide sections:', sections)
      }
    }
  }
}

checkGuideState().catch(console.error)
