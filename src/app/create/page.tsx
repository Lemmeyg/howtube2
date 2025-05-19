'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef, Suspense } from 'react'
import { GuideProvider, useGuide } from '@/contexts/guide-context'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { extractYouTubeVideoId } from '@/lib/validation/youtube'

function GuideEditorLoader({ url }: { url: string }) {
  const { dispatch } = useGuide()
  const [status, setStatus] = useState<'idle' | 'processing' | 'transcribing' | 'generating' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    let eventSource: EventSource | null = null

    async function startPipeline() {
      setStatus('processing')
      setError(null)
      try {
        const videoId = extractYouTubeVideoId(url)
        if (!videoId) {
          setError('Invalid YouTube URL')
          setStatus('error')
          return
        }

        const res = await fetch('/api/videos/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, videoId }),
          credentials: 'include',
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Failed to start processing')
          setStatus('error')
          return
        }

        // Start SSE connection
        const processingId = data.id
        eventSource = new EventSource(`/api/videos/status?id=${processingId}`, {
          withCredentials: true
        })

        eventSource.onmessage = async (event) => {
          const status = JSON.parse(event.data)
          console.log('Received status update:', status)

          switch (status.type) {
            case 'status':
              console.log('Processing status update:', status.status)
              switch (status.status) {
                case 'transcribing':
                  setStatus('transcribing')
                  break
                case 'completed':
                  console.log('Transcription completed, starting guide generation...')
                  setStatus('generating')
                  // Generate guide
                  try {
                    const guideConfig = {
                      style: 'detailed',
                      targetAudience: 'intermediate',
                      maxLength: 2000,
                      includeTimestamps: true
                    }

                    console.log('Sending guide generation request with config:', guideConfig)
                    const guideRes = await fetch('/api/videos/guide', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        id: processingId,
                        config: guideConfig 
                      }),
                      credentials: 'include',
                    })
                    const guideData = await guideRes.json()
                    console.log('Guide generation response:', guideData)
                    if (!guideRes.ok) {
                      console.error('Guide generation failed:', guideData)
                      setError(guideData.error || 'Failed to generate guide')
                      setStatus('error')
                      return
                    }
                    dispatch({ type: 'LOAD_GUIDE', payload: guideData })
                    setStatus('ready')
                  } catch (error) {
                    console.error('Error generating guide:', error)
                    setError('Failed to generate guide')
                    setStatus('error')
                  }
                  break
                case 'error':
                  setError(status.error || 'Processing failed')
                  setStatus('error')
                  break
              }
              break
          }
        }

        eventSource.onerror = (error) => {
          console.error('SSE error:', error)
          setError('Connection lost')
          setStatus('error')
          eventSource?.close()
        }
      } catch (error) {
        console.error('Error in pipeline initiation:', error)
        setError('Failed to start processing pipeline')
        setStatus('error')
      }
    }

    startPipeline()
    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [url, dispatch, user])

  if (status === 'processing') return <div>Processing video...</div>
  if (status === 'transcribing') return <div>Transcribing video...</div>
  if (status === 'generating') return <div>Generating guide...</div>
  if (status === 'error') return <div>Error: {error}</div>
  if (status === 'ready') return <div>Guide ready!</div>
  return null
}

function CreateContent() {
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

export default function CreatePage() {
  return (
    <Suspense fallback={<div>Loading create page...</div>}>
      <CreateContent />
    </Suspense>
  )
}
