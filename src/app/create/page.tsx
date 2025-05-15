'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { GuideProvider, useGuide } from '@/contexts/guide-context'
import { GuideViewer } from '@/components/guide/GuideViewer'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'

function GuideEditorLoader({ url }: { url: string }) {
  const { state, dispatch } = useGuide()
  const { user } = useAuth()
  const [status, setStatus] = useState<
    'init' | 'processing' | 'transcribing' | 'generating' | 'ready' | 'error'
  >('init')
  const [error, setError] = useState<string | null>(null)
  const [pipelineInitiated, setPipelineInitiated] = useState(false)

  useEffect(() => {
    let polling: NodeJS.Timeout
    let attempts = 0
    const MAX_ATTEMPTS = 20

    async function startPipeline() {
      if (!user) {
        setError('User not authenticated')
        setStatus('error')
        return
      }
      setStatus('processing')
      setError(null)
      try {
        const res = await fetch('/api/videos/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
          credentials: 'include',
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Failed to start processing')
          setStatus('error')
          return
        }
        const id = data.id || data.status?.id
        setStatus('transcribing')
        polling = setInterval(async () => {
          attempts++
          if (attempts > MAX_ATTEMPTS) {
            clearInterval(polling)
            setError('Processing timed out. Please try again later.')
            setStatus('error')
            return
          }
          try {
            const statusRes = await fetch(`/api/videos/process?id=${id}`, {
              credentials: 'include',
            })
            const statusData = await statusRes.json()
            if (!statusRes.ok) {
              clearInterval(polling)
              setError(statusData.error || 'Failed to check video status')
              setStatus('error')
              return
            }
            if (statusData.status && 
                (statusData.status.status === 'completed' || 
                 (statusData.status.status === 'transcribing' && statusData.status.transcription_job_id) || 
                 (statusData.status.current_step === 'pipeline_complete'))
            ) {
              if (statusData.status.transcription_job_id || (statusData.metadata && statusData.metadata.transcription_id)) {
                const transcriptionId = statusData.status.transcription_job_id || statusData.metadata.transcription_id;
                console.log('Polling transcription status for job ID:', transcriptionId);
                const transStatusRes = await fetch(`/api/videos/transcribe?id=${id}&transcriptionId=${transcriptionId}`, {
                    credentials: 'include',
                });
                const transStatusData = await transStatusRes.json();
                console.log('Transcription status response data:', transStatusData);

                if (!transStatusRes.ok) {
                    console.warn('Failed to get specific transcription status:', transStatusData.error)
                } else {
                    if (transStatusData.status === 'completed') {
                        clearInterval(polling)
                        setStatus('generating')
                        console.log('Making guide request for videoId:', id)
                        const guideRes = await fetch('/api/videos/guide', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id }),
                            credentials: 'include',
                        })
                        const guideData = await guideRes.json()
                        if (!guideRes.ok) {
                            setError(guideData.error || 'Failed to generate guide')
                            setStatus('error')
                            return
                        }
                        dispatch({ type: 'LOAD_GUIDE', payload: guideData })
                        setStatus('ready')
                        return
                    } else if (transStatusData.status === 'error') {
                        clearInterval(polling)
                        setError(transStatusData.error || 'Transcription failed in AssemblyAI')
                        setStatus('error')
                        return
                    } 
                }
              } else if (statusData.status.status === 'completed') {
                console.warn("video_processing is 'completed' but no transcription ID found. Proceeding to guide generation if applicable or this might be an error.");
                clearInterval(polling)
                setStatus('generating')
                const guideRes = await fetch('/api/videos/guide', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id }),
                    credentials: 'include',
                })
                const guideData = await guideRes.json()
                if (!guideRes.ok) {
                    setError(guideData.error || 'Failed to generate guide (after completion without transcription ID)')
                    setStatus('error')
                    return
                }
                dispatch({ type: 'LOAD_GUIDE', payload: guideData })
                setStatus('ready')
                return
              }
            } else if (statusData.status && statusData.status.status === 'error') {
              clearInterval(polling)
              setError(statusData.status.error || 'Video processing failed in the queue.')
              setStatus('error')
            }
          } catch (error) {
            console.error('Error polling status:', error)
            clearInterval(polling)
            setError('Error checking video status')
            setStatus('error')
          }
        }, 3000)
      } catch (error) {
        console.error('Error in pipeline initiation:', error)
        setError('Failed to start processing pipeline')
        setStatus('error')
      }
    }

    if (url && user && !pipelineInitiated) {
      setPipelineInitiated(true)
      startPipeline()
    }
    return () => {
      if (polling) clearInterval(polling)
    }
  }, [url, dispatch, user, pipelineInitiated])

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
