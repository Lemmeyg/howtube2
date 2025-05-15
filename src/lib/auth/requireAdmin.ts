import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerActionSupabaseClient } from '@/lib/supabase/server'
import { getUserRole } from './getUserRole'

export async function requireAdmin(handler: (userId: string) => Promise<NextResponse>) {
  try {
    const cookieStore = cookies()
    const supabase = createServerActionSupabaseClient(cookieStore)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.email || session.user.id
    const role = await getUserRole(supabase, userId)
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    }
    return handler(userId)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
