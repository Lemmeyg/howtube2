'use client'
import { AuthProvider } from '@/contexts/auth-context'
import React from 'react'

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
