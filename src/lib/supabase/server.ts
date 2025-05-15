import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Use this in server components only
export function createServerComponentSupabaseClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(_name: string, _value: string, _options: unknown) {
          // Not supported in app directory yet
        },
        remove(_name: string, _options: unknown) {
          // Not supported in app directory yet
        },
      },
    }
  )
}

// Use this in API routes and server actions
export function createServerActionSupabaseClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(_name: string, _value: string, _options: unknown) {
          // Not supported in app directory yet
        },
        remove(_name: string, _options: unknown) {
          // Not supported in app directory yet
        },
      },
    }
  )
}
