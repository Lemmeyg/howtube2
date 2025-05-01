import { User } from '@supabase/supabase-js'

export interface AuthUser extends User {
  id: string
  email?: string
  user_metadata: {
    full_name?: string
    avatar_url?: string
  }
}

export interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  error: Error | null
}

export interface AuthContextType extends AuthState {
  signUp: (email: string, password: string, metadata?: { full_name?: string }) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updateProfile: (profile: Partial<AuthUser['user_metadata']>) => Promise<void>
}
