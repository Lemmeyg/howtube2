'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface Stat {
  label: string
  value: string | number
}

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<Stat[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // TODO: Fetch real analytics from backend
    setStats([
      { label: 'Total Users', value: 1234 },
      { label: 'Active Users (30d)', value: 456 },
      { label: 'Guides Created', value: 789 },
      { label: 'Pro Subscribers', value: 42 },
    ])
    setLoading(false)
  }, [])

  if (loading) return <div>Loading analytics...</div>

  return (
    <div className="py-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {stats.map(stat => (
          <div key={stat.label} className="border rounded-lg p-6 flex flex-col items-center">
            <div className="text-3xl font-bold mb-2">{stat.value}</div>
            <div className="text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>
      {/* TODO: Add charts for user growth, guide creation, etc. */}
      <Button variant="secondary" onClick={() => router.push('/admin')}>
        Back to Admin Dashboard
      </Button>
    </div>
  )
}
