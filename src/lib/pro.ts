import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Supabase = ReturnType<typeof createClient>

// Free-tier limits. Pro (is_pro on the users row) removes all of them.
export const FREE_MEMORY_LIMIT = 50
export const FREE_PHOTOS_PER_MEMORY = 3
export const FREE_BULK_LIMIT = 10

export const PRO_BENEFITS = [
  `Unlimited bulk upload (free includes ${FREE_BULK_LIMIT} photos at a time)`,
  'Video memories and unlimited photos per memory',
  `Unlimited memories (free includes ${FREE_MEMORY_LIMIT})`,
  'Insights & Year in Food — your taste, wrapped',
]

/** null while loading, then true/false. */
export function useIsPro(): boolean | null {
  const [isPro, setIsPro] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) { setIsPro(false); return }
      const { data } = await supabase.from('users').select('is_pro').eq('id', user.id).single()
      if (!cancelled) setIsPro(data?.is_pro ?? false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  return isPro
}

/**
 * Returns an error message if the free plan is full, or null if a new
 * memory can be saved. Call before inserting a memory.
 */
export async function checkMemoryAllowance(supabase: Supabase, userId: string, isPro: boolean | null): Promise<string | null> {
  if (isPro) return null
  const { count } = await supabase
    .from('memories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if ((count ?? 0) >= FREE_MEMORY_LIMIT) {
    return `Your free plan is full (${FREE_MEMORY_LIMIT} memories). Mimora Pro — coming soon — unlocks unlimited memories.`
  }
  return null
}
