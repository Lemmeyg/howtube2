import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerActionSupabaseClient } from '@/lib/supabase/server'
import { getUserSubscriptionTier } from './getUserSubscriptionTier'
import { getUserGuideCount } from '@/lib/guide/getUserGuideCount'

interface RequireOptions {
  tier: 'pro' | 'free'
  quota?: number // Only applies to free tier
}

export async function requireSubscriptionTier(
  handler: (userId: string) => Promise<NextResponse>,
  options: RequireOptions
) {
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
    const tier = await getUserSubscriptionTier(supabase, userId)
    if (options.tier === 'pro' && tier !== 'pro') {
      return NextResponse.json({ error: 'Upgrade required for this feature.' }, { status: 402 })
    }
    if (options.tier === 'free' && options.quota) {
      const count = await getUserGuideCount(supabase, userId)
      if (count >= options.quota && tier === 'free') {
        return NextResponse.json(
          { error: 'Free tier quota exceeded. Upgrade to Pro.' },
          { status: 402 }
        )
      }
    }
    return handler(userId)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
