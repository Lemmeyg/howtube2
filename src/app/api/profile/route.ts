import { NextResponse } from 'next/server'
import { createServerActionSupabaseClient } from '@/lib/supabase/server'
import { protectApi } from '@/lib/auth/protect-api'

export async function GET() {
  return protectApi(async () => {
    const supabase = createServerActionSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session!.user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(profile)
  })
}

export async function PUT(request: Request) {
  return protectApi(async () => {
    const supabase = createServerActionSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const body = await request.json()

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        username: body.username,
        full_name: body.fullName,
        bio: body.bio,
        avatar_url: body.avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', session!.user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(profile)
  })
}
