'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SettingsPage() {
  const supabase = createClient()
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
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      if (user.email) setEmail(user.email)
      const { data } = await supabase.from('users').select('display_name').eq('id', user.id).single()
      if (data?.display_name) setDisplayName(data.display_name)
    }
    load()
  }, [])

  async function saveName() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
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
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setDeleteError(data.error ?? 'Deletion failed — please try again')
        setDeleting(false)
        return
      }
      await supabase.auth.signOut()
      router.push('/auth')
    } catch {
      setDeleteError('Deletion failed — check your connection and try again')
      setDeleting(false)
    }
  }

  return (
    <div className="page-enter min-h-screen" style={{ background: 'var(--stone-400)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Header */}
      <div className="page-header px-5 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/profile" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--stone-200)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16191B" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </Link>
          <h1 className="text-xl font-semibold">Account settings</h1>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">

        {/* Display name */}
        <div className="rounded-2xl p-4" style={{ background: '#fff', border: '0.5px solid rgba(16,20,22,0.08)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--slate)' }}>Profile</p>
          <div className="mb-3">
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--slate)' }}>Display name</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full text-sm px-4 py-2.5 rounded-xl outline-none"
              style={{ border: '1.5px solid var(--stone-500)', background: 'var(--stone-100)', color: 'var(--teal-600)' }} />
          </div>
          <div className="mb-4">
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--slate)' }}>Email</label>
            <input type="email" value={email} disabled
              className="w-full text-sm px-4 py-2.5 rounded-xl outline-none"
              style={{ border: '1.5px solid var(--stone-500)', background: '#f5f5f5', color: 'var(--slate)' }} />
            <p className="text-xs mt-1" style={{ color: 'var(--slate-light)' }}>Email cannot be changed</p>
          </div>
          <button onClick={saveName} disabled={saving}
            className="w-full py-3 rounded-2xl text-sm font-semibold"
            style={{ background: 'var(--teal-600)', color: 'var(--stone-400)', opacity: saving ? 0.6 : 1 }}>
            {nameSuccess ? '✓ Saved' : saving ? 'Saving…' : 'Save name'}
          </button>
        </div>

        {/* Password */}
        <div className="rounded-2xl p-4" style={{ background: '#fff', border: '0.5px solid rgba(16,20,22,0.08)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--slate)' }}>Password</p>

          <div className="mb-3">
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--slate)' }}>New password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full text-sm px-4 py-2.5 rounded-xl outline-none"
              style={{ border: '1.5px solid var(--stone-500)', background: 'var(--stone-100)' }} />
          </div>
          <div className="mb-4">
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--slate)' }}>Confirm new password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full text-sm px-4 py-2.5 rounded-xl outline-none"
              style={{ border: '1.5px solid var(--stone-500)', background: 'var(--stone-100)' }} />
          </div>

          {passwordError && <div className="rounded-xl px-4 py-3 mb-3 text-sm" style={{ background: 'rgba(163,45,45,0.08)', color: 'var(--danger)' }}>{passwordError}</div>}
          {passwordSuccess && <div className="rounded-xl px-4 py-3 mb-3 text-sm" style={{ background: 'rgba(16,20,22,0.08)', color: 'var(--teal-600)' }}>✓ Password updated successfully</div>}

          <button onClick={changePassword} disabled={savingPassword || !newPassword}
            className="w-full py-3 rounded-2xl text-sm font-semibold mb-2"
            style={{ background: 'var(--teal-600)', color: 'var(--stone-400)', opacity: savingPassword || !newPassword ? 0.5 : 1 }}>
            {savingPassword ? 'Updating…' : 'Update password'}
          </button>

          <button onClick={sendResetEmail} disabled={resetSent}
            className="w-full py-2.5 rounded-2xl text-sm font-medium"
            style={{ background: 'var(--stone-200)', color: 'var(--slate)' }}>
            {resetSent ? '✓ Reset email sent' : 'Send password reset email instead'}
          </button>
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl p-4" style={{ background: '#fff', border: '0.5px solid rgba(163,45,45,0.15)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--danger)' }}>Danger zone</p>
          <p className="text-xs mb-3" style={{ color: 'var(--slate)' }}>Permanently delete your account and all your data including memories, photos, and wishlist.</p>
          {deleteError && <div className="rounded-xl px-4 py-3 mb-3 text-sm" style={{ background: 'rgba(163,45,45,0.08)', color: 'var(--danger)' }}>{deleteError}</div>}
          <button onClick={deleteAccount} disabled={deleting} className="w-full py-3 rounded-2xl text-sm font-medium"
            style={{ color: 'var(--danger)', background: 'rgba(163,45,45,0.08)', border: '0.5px solid rgba(163,45,45,0.2)', opacity: deleting ? 0.6 : 1 }}>
            {deleting ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </div>
    </div>
  )
}
