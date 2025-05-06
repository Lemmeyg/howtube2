'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Grid } from '@/components/ui/Grid'
import { Loading } from '@/components/ui/Loading'
import GuideCard from '@/components/guide/GuideCard'
import { supabase } from '@/lib/supabase/client'
import { GuideStorage } from '@/lib/guide/storage'
import { GuideMetadata } from '@/lib/guide/types'
import SubscriptionManagement from './subscription'

export default function DashboardPage() {
  const [guides, setGuides] = useState<GuideMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // TODO: Replace with real user ID from auth context
  const userId = 'mock-user-id'

  useEffect(() => {
    const fetchGuides = async () => {
      setLoading(true)
      setError('')
      try {
        const storage = new GuideStorage(supabase)
        const data = await storage.listGuides(userId)
        setGuides(data)
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Failed to load guides')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchGuides()
  }, [userId])

  const total = guides.length
  const completed = guides.filter(g => g.status === 'completed').length
  const inProgress = guides.filter(g => g.status === 'generating').length

  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <p className="mb-8 text-muted-foreground">
        Welcome to your dashboard! Here you&apos;ll see your guides and recent activity.
      </p>
      <SubscriptionManagement />
      <Grid cols="grid-cols-1 md:grid-cols-3" gap="gap-6" className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Total Guides</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{total}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-green-600">{completed}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-yellow-600">{inProgress}</span>
          </CardContent>
        </Card>
      </Grid>
      <h2 className="text-xl font-semibold mb-4">Recent Guides</h2>
      {loading ? (
        <Loading message="Loading your guides..." />
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : guides.length === 0 ? (
        <div className="text-muted-foreground">No guides yet. Start by creating a new guide!</div>
      ) : (
        <Grid cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" gap="gap-6">
          {guides.slice(0, 6).map(guide => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </Grid>
      )}
    </div>
  )
}
