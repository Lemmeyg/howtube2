import { Metadata } from 'next'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export const metadata: Metadata = {
  title: 'Reset Password - HowTube',
  description: 'Reset your HowTube account password',
}

export default function ResetPasswordPage() {
  return (
    <div className="container relative flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="w-full max-w-sm">
        <ResetPasswordForm />
      </div>
    </div>
  )
} 