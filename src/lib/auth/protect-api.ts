// IMPORTANT: This import must be mocked in tests for correct error handling
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerActionSupabaseClient } from '@/lib/supabase/server'

export async function protectApi(handler: () => Promise<NextResponse>) {
  try {
    const cookieStore = cookies()
    const allCookies = cookieStore.getAll()
    console.log(
      'protectApi: All cookies:',
      allCookies.map(c => ({ name: c.name, value: c.value.substring(0, 10) + '...' }))
    )

    const supabase = createServerActionSupabaseClient()
    console.log('protectApi: Supabase client created')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    console.log('protectApi: User error if any:', userError)
    console.log(
      'protectApi: User data:',
      user
        ? {
            id: user.id,
            email: user.email,
            role: user.role,
          }
        : null
    )

    if (!user) {
      console.warn('protectApi: No user found, returning Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await handler()
    return response
  } catch (error) {
    console.log('protectApi error:', error)
    console.error('API route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
