'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  role: 'admin' | 'user'
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // TODO: Fetch users from backend
    setUsers([
      { id: '1', email: 'admin@example.com', role: 'admin' },
      { id: '2', email: 'user1@example.com', role: 'user' },
      { id: '3', email: 'user2@example.com', role: 'user' },
    ])
    setLoading(false)
  }, [])

  const handlePromote = (id: string) => {
    // TODO: Promote user to admin
    alert(`Promoted user ${id} to admin (not implemented)`)
  }
  const handleDemote = (id: string) => {
    // TODO: Demote user to regular
    alert(`Demoted user ${id} to user (not implemented)`)
  }
  const handleRemove = (id: string) => {
    // TODO: Remove user
    alert(`Removed user ${id} (not implemented)`)
  }

  if (loading) return <div>Loading users...</div>

  return (
    <div className="py-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      <table className="w-full border rounded mb-8">
        <thead>
          <tr className="bg-muted">
            <th className="p-2 text-left">Email</th>
            <th className="p-2 text-left">Role</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id} className="border-t">
              <td className="p-2">{user.email}</td>
              <td className="p-2">{user.role}</td>
              <td className="p-2 flex gap-2">
                {user.role === 'user' ? (
                  <Button size="sm" onClick={() => handlePromote(user.id)}>
                    Promote to Admin
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => handleDemote(user.id)}>
                    Demote
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => handleRemove(user.id)}>
                  Remove
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button variant="secondary" onClick={() => router.push('/admin')}>
        Back to Admin Dashboard
      </Button>
    </div>
  )
}
