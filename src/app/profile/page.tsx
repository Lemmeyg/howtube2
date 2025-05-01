import { Metadata } from 'next'
import { RequireAuth } from '@/components/auth/require-auth'
import { ProfileForm } from '@/components/auth/profile-form'

export const metadata: Metadata = {
  title: 'Profile - HowTube',
  description: 'Manage your HowTube profile',
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <div className="container py-8">
        <ProfileForm />
      </div>
    </RequireAuth>
  )
} 