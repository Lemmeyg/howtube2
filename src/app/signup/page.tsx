import { Metadata } from 'next'
import { SignupForm } from '@/components/auth/signup-form'

export const metadata: Metadata = {
  title: 'Sign Up - HowTube',
  description: 'Create your HowTube account',
}

export default function SignupPage() {
  return (
    <div className="container relative flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <div className="w-full max-w-sm">
        <SignupForm />
      </div>
    </div>
  )
} 