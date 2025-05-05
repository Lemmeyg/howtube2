import { SupabaseClient } from '@supabase/supabase-js'

export async function getUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<'admin' | 'user'> {
  // TODO: Replace with real RBAC or claims in production
  const { data, error } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .single()
  if (error || !data) return 'user'
  return 'admin'
}
