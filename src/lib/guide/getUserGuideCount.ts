import { SupabaseClient } from '@supabase/supabase-js'

export async function getUserGuideCount(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('guides')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) return 0
  return count || 0
}
