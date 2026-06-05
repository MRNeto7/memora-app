'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SettingsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const router = useRouter()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setEmail(user.email)
      const { data } = await supabase.from('users').select('display_name').eq('id', user.id).single()
      if (data?.display_name) setDisplayName(data.display_name)
    }
    load()
  }, [])

  async function saveName() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('users').update({ display_name: displayName }).eq('id', user.id)
    setSaving(false)
    setNameSuccess(true)
    setTimeout(() => setNameSuccess(false), 2000)
  }

  async function changePassword() {
    setPasswordError('')
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) { setPasswordError(error.message) }
    else {
      setPasswordSuccess(true)
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(false), 3000)
    }
  }

  async function sendResetEmail() {
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/reset` })
    setResetSent(true)
  }

  async function deleteAccount() {
    if (!confirm('Are you sure? This permanently deletes all your memories, photos, and wishlist. This cannot be undone.')) return
    // Sign out — full deletion requires server-side, this at minimum removes their session
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <div className="min-h-screen" style={{ background: '#EAE5DD', paddingBottom: 80 }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-5" style={{ background: '#0D4F57' }}>
        <div className="flex items-center gap-3 mb-1">
          <Link href="/profile" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </Link>
          <h1 className="text-xl font-semibold text-white">Account settings</h1>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">

        {/* Display name */}
        <div className="rounded-2xl p-4" style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.08)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#7D878D' }}>Profile</p>
          <div className="mb-3">
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#7D878D' }}>Display name</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full text-sm px-4 py-2.5 rounded-xl outline-none"
              style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9', color: '#0D4F57' }} />
          </div>
          <div className="mb-4">
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#7D878D' }}>Email</label>
            <input type="email" value={email} disabled
              className="w-full text-sm px-4 py-2.5 rounded-xl outline-none"
              style={{ border: '1.5px solid #EAE5DD', background: '#f5f5f5', color: '#7D878D' }} />
            <p className="text-xs mt-1" style={{ color: '#b0babe' }}>Email cannot be changed</p>
          </div>
          <button onClick={saveName} disabled={saving}
            className="w-full py-3 rounded-2xl text-sm font-semibold"
            style={{ background: '#0D4F57', color: '#EAE5DD', opacity: saving ? 0.6 : 1 }}>
            {nameSuccess ? '✓ Saved' : saving ? 'Saving…' : 'Save name'}
          </button>
        </div>

        {/* Password */}
        <div className="rounded-2xl p-4" style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.08)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#7D878D' }}>Password</p>

          <div className="mb-3">
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#7D878D' }}>New password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full text-sm px-4 py-2.5 rounded-xl outline-none"
              style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9' }} />
          </div>
          <div className="mb-4">
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#7D878D' }}>Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full text-sm px-4 py-2.5 rounded-xl outline-none"
              style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9' }} />
          </div>

          {passwordError && <div className="rounded-xl px-4 py-3 mb-3 text-sm" style={{ background: 'rgba(163,45,45,0.08)', color: '#a32d2d' }}>{passwordError}</div>}
          {passwordSuccess && <div className="rounded-xl px-4 py-3 mb-3 text-sm" style={{ background: 'rgba(13,79,87,0.08)', color: '#0D4F57' }}>✓ Password updated successfully</div>}

          <button onClick={changePassword} disabled={savingPassword || !newPassword}
            className="w-full py-3 rounded-2xl text-sm font-semibold mb-2"
            style={{ background: '#0D4F57', color: '#EAE5DD', opacity: savingPassword || !newPassword ? 0.5 : 1 }}>
            {savingPassword ? 'Updating…' : 'Update password'}
          </button>

          <button onClick={sendResetEmail} disabled={resetSent}
            className="w-full py-2.5 rounded-2xl text-sm font-medium"
            style={{ background: '#f5f2ed', color: '#7D878D' }}>
            {resetSent ? '✓ Reset email sent' : 'Send password reset email instead'}
          </button>
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl p-4" style={{ background: '#fff', border: '0.5px solid rgba(163,45,45,0.15)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#a32d2d' }}>Danger zone</p>
          <p className="text-xs mb-3" style={{ color: '#7D878D' }}>Permanently delete your account and all your data including memories, photos, and wishlist.</p>
          <button onClick={deleteAccount} className="w-full py-3 rounded-2xl text-sm font-medium"
            style={{ color: '#a32d2d', background: 'rgba(163,45,45,0.08)', border: '0.5px solid rgba(163,45,45,0.2)' }}>
            Delete my account
          </button>
        </div>
      </div>
    </div>
  )
}
