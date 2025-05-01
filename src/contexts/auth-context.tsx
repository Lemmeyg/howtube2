import { createContext, useContext, useEffect, useState } from 'react'
import { AuthContextType, AuthState, AuthUser } from '@/types/auth'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/config/logger'

const initialState: AuthState = {
  user: null,
  isLoading: true,
  error: null,
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState)

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({
        ...prev,
        user: session?.user as AuthUser | null,
        isLoading: false,
      }))
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(prev => ({
        ...prev,
        user: session?.user as AuthUser | null,
        isLoading: false,
      }))
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string, metadata?: { full_name?: string }) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      })
      if (error) throw error
    } catch (error) {
      logger.error('Error signing up:', error)
      setState(prev => ({ ...prev, error: error as Error }))
      throw error
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
    } catch (error) {
      logger.error('Error signing in:', error)
      setState(prev => ({ ...prev, error: error as Error }))
      throw error
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      logger.error('Error signing out:', error)
      setState(prev => ({ ...prev, error: error as Error }))
      throw error
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
    } catch (error) {
      logger.error('Error resetting password:', error)
      setState(prev => ({ ...prev, error: error as Error }))
      throw error
    }
  }

  const updateProfile = async (profile: Partial<AuthUser['user_metadata']>) => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: profile,
      })
      if (error) throw error
    } catch (error) {
      logger.error('Error updating profile:', error)
      setState(prev => ({ ...prev, error: error as Error }))
      throw error
    }
  }

  const value = {
    ...state,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 