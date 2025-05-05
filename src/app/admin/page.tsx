'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // TODO: Replace with real admin check (API call or context)
    // For now, allow access
    setIsAdmin(true)
    setLoading(false)
  }, [])

  if (loading) return <div>Loading admin dashboard...</div>
  if (!isAdmin) {
    router.replace('/login')
    return null
  }

  return (
    <div className="py-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="border rounded-lg p-6 flex flex-col">
          <h2 className="text-xl font-semibold mb-2">User Management</h2>
          <p className="mb-4 text-muted-foreground">
            View and manage users, roles, and permissions.
          </p>
          <Button onClick={() => router.push('/admin/users')}>Manage Users</Button>
        </div>
        <div className="border rounded-lg p-6 flex flex-col">
          <h2 className="text-xl font-semibold mb-2">System Monitoring</h2>
          <p className="mb-4 text-muted-foreground">
            Monitor system health, performance, and logs.
          </p>
          <Button onClick={() => router.push('/admin/monitor')}>View Monitoring</Button>
        </div>
        <div className="border rounded-lg p-6 flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Analytics</h2>
          <p className="mb-4 text-muted-foreground">Analyze usage patterns and trends.</p>
          <Button onClick={() => router.push('/admin/analytics')}>View Analytics</Button>
        </div>
        <div className="border rounded-lg p-6 flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Configuration</h2>
          <p className="mb-4 text-muted-foreground">Manage system settings and prompts.</p>
          <Button onClick={() => router.push('/admin/config')}>Manage Config</Button>
        </div>
      </div>
      {/* TODO: Add job queue, error logs, moderation, backup/restore, etc. */}
    </div>
  )
}
