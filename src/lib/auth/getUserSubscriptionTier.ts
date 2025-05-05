import { SupabaseClient } from '@supabase/supabase-js'

export async function getUserSubscriptionTier(
  supabase: SupabaseClient,
  userId: string
): Promise<'free' | 'pro'> {
  // TODO: Replace with real Stripe lookup or join
  const { data, error } = await supabase
    .from('pro_users')
    .select('user_id')
    .eq('user_id', userId)
    .single()
  if (error || !data) return 'free'
  return 'pro'
}
