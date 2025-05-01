import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export function createServerClient(cookieStore: ReturnType<typeof cookies>) {
  return createServerComponentClient({
    cookies: () => cookieStore,
  })
} 