'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Status = 'verifying' | 'ready' | 'invalid' | 'done'

// Landing page for password-recovery emails. The link arrives with a
// one-time code which we exchange for a session, then let the user set
// a new password.
export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()

  const [status, setStatus] = useState<Status>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function verify() {
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (!cancelled) setStatus(exchangeError ? 'invalid' : 'ready')
        return
      }
      // No code in the URL — the client may have already picked up the
      // session from the link's hash fragment
      const { data: { session } } = await supabase.auth.getSession()
      if (!cancelled) setStatus(session ? 'ready' : 'invalid')
    }
    verify()
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) { setError(updateError.message); return }
    setStatus('done')
    setTimeout(() => { router.push('/') }, 1500)
  }

  return (
    <div className="page-enter min-h-screen flex flex-col items-center justify-center px-5" style={{ background: 'var(--teal-600)' }}>
      <h1 className="text-2xl font-semibold mb-6" style={{ color: 'var(--stone-400)' }}>Reset password</h1>

      <div className="w-full max-w-sm rounded-3xl p-6" style={{ background: 'var(--stone-400)' }}>
        {status === 'verifying' && (
          <p className="text-sm text-center py-6" style={{ color: 'var(--slate)' }}>Checking your reset link…</p>
        )}

        {status === 'invalid' && (
          <div className="text-center py-4">
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--teal-600)' }}>This link has expired or already been used</p>
            <p className="text-xs mb-5" style={{ color: 'var(--slate)' }}>Request a new reset link from the sign-in screen.</p>
            <button onClick={() => router.push('/auth')}
              className="px-6 py-3 rounded-2xl text-sm font-semibold"
              style={{ background: 'var(--teal-600)', color: 'var(--stone-400)' }}>
              Back to sign in
            </button>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--slate)' }}>New password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters" required autoComplete="new-password"
                className="w-full text-sm px-4 py-3 rounded-xl outline-none"
                style={{ background: '#fff', border: '1px solid rgba(16,20,22,0.12)', color: 'var(--teal-600)' }} />
            </div>
            <div className="mb-4">
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--slate)' }}>Confirm new password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter your password" required autoComplete="new-password"
                className="w-full text-sm px-4 py-3 rounded-xl outline-none"
                style={{ background: '#fff', border: '1px solid rgba(16,20,22,0.12)', color: 'var(--teal-600)' }} />
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: 'rgba(163,45,45,0.08)', color: 'var(--danger)', borderLeft: '3px solid var(--danger)' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={saving}
              className="w-full py-3.5 rounded-2xl text-sm font-semibold"
              style={{ background: 'var(--teal-600)', color: 'var(--stone-400)', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        )}

        {status === 'done' && (
          <div className="text-center py-6">
            <p className="text-2xl mb-2">✓</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--teal-600)' }}>Password updated</p>
            <p className="text-xs mt-1" style={{ color: 'var(--slate)' }}>Taking you to your map…</p>
          </div>
        )}
      </div>
    </div>
  )
}
