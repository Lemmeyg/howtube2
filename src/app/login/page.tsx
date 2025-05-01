import { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Login - HowTube',
  description: 'Login to your HowTube account',
}

export default function LoginPage() {
  return (
    <div className="container relative flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
