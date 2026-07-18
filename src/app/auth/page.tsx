'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function AuthPage() {
  const supabase = createClient()
  const router = useRouter()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }

    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
    }

    setLoading(true)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setSuccess('Account created! Check your email to confirm, then sign in.')
        setMode('signin')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message === 'Invalid login credentials'
          ? 'Incorrect email or password.'
          : error.message)
      } else {
        router.push('/')
        router.refresh()
      }
    }

    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-5"
      style={{ background: 'var(--teal-600)' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="mb-4 rounded-3xl overflow-hidden" style={{ width: 96, height: 96, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
          <Image src="/logo.png" alt="Mimora" width={96} height={96} className="w-full h-full object-cover" priority />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--stone-400)' }}>Mimora</h1>
        <p className="text-sm mt-1.5" style={{ color: 'rgba(234,229,221,0.55)' }}>Pin your food memories to the map</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-3xl p-6" style={{ background: 'var(--stone-400)' }}>

        {/* Tab toggle */}
        <div className="flex rounded-2xl p-1 mb-6" style={{ background: 'rgba(13,79,87,0.08)' }}>
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setSuccess(null) }}
              className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: mode === m ? 'var(--teal-600)' : 'transparent',
                color: mode === m ? 'var(--stone-400)' : 'var(--slate)',
              }}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div className="mb-3">
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--slate)' }}>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full text-sm px-4 py-3 rounded-xl outline-none"
              style={{ background: '#fff', border: '1px solid rgba(13,79,87,0.12)', color: 'var(--teal-600)' }}
            />
          </div>

          {/* Password */}
          <div className="mb-3">
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--slate)' }}>Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="w-full text-sm px-4 py-3 rounded-xl outline-none pr-12"
                style={{ background: '#fff', border: '1px solid rgba(13,79,87,0.12)', color: 'var(--teal-600)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: 'var(--slate)' }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Confirm password (signup only) */}
          {mode === 'signup' && (
            <div className="mb-3">
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--slate)' }}>Confirm password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full text-sm px-4 py-3 rounded-xl outline-none"
                style={{ background: '#fff', border: '1px solid rgba(13,79,87,0.12)', color: 'var(--teal-600)' }}
              />
            </div>
          )}

          {/* Forgot password */}
          {mode === 'signin' && (
            <div className="text-right mb-4">
              <button
                type="button"
                onClick={() => handleForgotPassword(email, supabase, setSuccess, setError)}
                className="text-xs"
                style={{ color: 'var(--slate)' }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Error / success */}
          {error && (
            <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: 'rgba(163,45,45,0.08)', color: 'var(--danger)', borderLeft: '3px solid var(--danger)' }}>
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: 'rgba(13,79,87,0.08)', color: 'var(--teal-600)', borderLeft: '3px solid var(--teal-600)' }}>
              {success}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-opacity"
            style={{
              background: 'var(--teal-600)',
              color: 'var(--stone-400)',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-xs text-center mt-5" style={{ color: 'var(--slate)' }}>
          By continuing you agree to Mimora&apos;s terms and privacy policy.
        </p>
      </div>
    </div>
  )
}

async function handleForgotPassword(
  email: string,
  supabase: ReturnType<typeof createClient>,
  setSuccess: (s: string) => void,
  setError: (s: string) => void
) {
  if (!email) {
    setError('Enter your email above first.')
    return
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset`,
  })
  if (error) setError(error.message)
  else setSuccess('Password reset link sent to your email.')
}
