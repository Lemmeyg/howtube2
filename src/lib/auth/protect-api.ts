import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function protectApi(handler: () => Promise<Response>) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return handler()
  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 