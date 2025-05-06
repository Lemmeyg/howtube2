'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { GuideProvider, useGuide } from '@/contexts/guide-context'
import { GuideViewer } from '@/components/guide/GuideViewer'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'

function GuideEditorLoader({ url }: { url: string }) {
  const { state, dispatch } = useGuide()
  const [status, setStatus] = useState<
    'init' | 'processing' | 'transcribing' | 'generating' | 'ready' | 'error'
  >('init')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let videoId: string | null = null
    let polling: NodeJS.Timeout

    async function startPipeline() {
      setStatus('processing')
      setError(null)
      // 1. Start processing
      const res = await fetch('/api/videos/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to start processing')
        setStatus('error')
        return
      }
      videoId = data.status.videoId || data.status.video_id
      // 2. Poll for processing/transcription status
      setStatus('transcribing')
      polling = setInterval(async () => {
        const statusRes = await fetch(`/api/videos/process?videoId=${videoId}`)
        const statusData = await statusRes.json()
        if (statusData.status && statusData.status.status === 'completed') {
          clearInterval(polling)
          // 3. Generate guide
          setStatus('generating')
          const guideRes = await fetch('/api/videos/guide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId }),
          })
          const guideData = await guideRes.json()
          if (!guideRes.ok) {
            setError(guideData.error || 'Failed to generate guide')
            setStatus('error')
            return
          }
          // 4. Load guide into context
          dispatch({ type: 'LOAD_GUIDE', payload: guideData })
          setStatus('ready')
        } else if (statusData.status && statusData.status.status === 'error') {
          clearInterval(polling)
          setError('Video processing failed.')
          setStatus('error')
        }
      }, 3000)
    }

    startPipeline()
    return () => {
      if (polling) clearInterval(polling)
    }
  }, [url, dispatch])

  if (status === 'processing') return <div>Processing video...</div>
  if (status === 'transcribing') return <div>Transcribing audio...</div>
  if (status === 'generating') return <div>Generating guide...</div>
  if (status === 'error') return <div className="text-red-600">{error}</div>
  if (!state.guide) return <div>Loading...</div>
  return <GuideViewer />
}

export default function CreatePage() {
  const searchParams = useSearchParams()
  const url = searchParams.get('url')
  const { user, isLoading } = useAuth()
  const router = useRouter()

  // Show loading spinner while auth state is loading
  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  // If not logged in, redirect to login
  if (!user) {
    if (typeof window !== 'undefined') {
      router.push('/login')
    }
    return (
      <div className="p-8 text-center text-red-600">
        You must be logged in to create a guide.{' '}
        <a href="/login" className="underline text-blue-600">
          Login
        </a>
      </div>
    )
  }

  if (!url) return <div className="p-8 text-center text-red-600">No YouTube URL provided.</div>

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Guide Editor</h1>
      <div className="mb-4 text-muted-foreground">
        Source video: <span className="break-all">{url}</span>
      </div>
      <GuideProvider>
        <GuideEditorLoader url={url} />
      </GuideProvider>
    </div>
  )
}
