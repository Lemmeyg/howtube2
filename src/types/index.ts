import { Database } from './supabase'

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

// User related types
export type User = Tables<'users'>
export type Profile = Tables<'profiles'>

// Guide related types
export type Guide = Tables<'guides'>
export type GuideVersion = Tables<'guide_versions'>
export type Tag = Tables<'tags'>
export type GuideTag = Tables<'guide_tags'>

// Auth types
export interface Session {
  user: User
  access_token: string
  refresh_token: string
}

// API Response types
export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}
