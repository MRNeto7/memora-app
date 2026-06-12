import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Permanently deletes the signed-in user's account: all storage files,
// then the auth user — which cascades through public.users to memories,
// memory_photos, wishlists, and friend_requests via ON DELETE CASCADE.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set — account deletion unavailable')
    return NextResponse.json({ error: 'Account deletion is not configured' }, { status: 500 })
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // Photos live at {userId}/{memoryId}/{file} — walk both levels
    const paths: string[] = []
    const { data: entries } = await admin.storage.from('memory-photos').list(user.id, { limit: 1000 })
    for (const entry of entries ?? []) {
      if (entry.id) {
        paths.push(`${user.id}/${entry.name}`)
      } else {
        const { data: files } = await admin.storage.from('memory-photos').list(`${user.id}/${entry.name}`, { limit: 1000 })
        for (const file of files ?? []) paths.push(`${user.id}/${entry.name}/${file.name}`)
      }
    }
    if (paths.length > 0) {
      await admin.storage.from('memory-photos').remove(paths)
    }

    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) {
      console.error('Account deletion failed:', error.message)
      return NextResponse.json({ error: 'Deletion failed — please try again' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Account deletion error:', err)
    return NextResponse.json({ error: 'Deletion failed — please try again' }, { status: 500 })
  }
}
