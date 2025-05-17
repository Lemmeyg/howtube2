'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { GuideProvider } from '@/contexts/guide-context'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'

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
        <div>Guide ready!</div>
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
