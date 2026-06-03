'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: '#f8faf9' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: '#1e7a4c' }}
        >
          <span style={{ fontSize: 32 }}>📍</span>
        </div>
        <h1 className="text-2xl font-semibold" style={{ color: '#1a2e23' }}>Memora</h1>
        <p className="text-sm mt-1" style={{ color: '#6b7c74' }}>Pin your food memories to the map</p>
      </div>

      <div
        className="w-full max-w-sm bg-white rounded-3xl p-8"
        style={{ border: '1px solid #e8f0eb' }}
      >
        {sent ? (
          <div className="text-center">
            <div className="text-4xl mb-4">✉️</div>
            <h2 className="font-semibold text-base mb-2" style={{ color: '#1a2e23' }}>Check your email</h2>
            <p className="text-sm" style={{ color: '#6b7c74' }}>
              We sent a magic link to <strong>{email}</strong>. Click it to sign in — no password needed.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-6 text-sm"
              style={{ color: '#1e7a4c' }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <h2 className="font-semibold text-base mb-6" style={{ color: '#1a2e23' }}>Sign in to Memora</h2>

            {/* Google OAuth */}
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl mb-4 text-sm font-medium transition-opacity"
              style={{
                border: '1px solid #e0e0e0',
                background: '#fff',
                color: '#1a2e23',
                opacity: loading ? 0.6 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: '#e8f0eb' }} />
              <span className="text-xs" style={{ color: '#9eb3a4' }}>or</span>
              <div className="flex-1 h-px" style={{ background: '#e8f0eb' }} />
            </div>

            {/* Magic link */}
            <form onSubmit={handleMagicLink}>
              <div className="mb-3">
                <label className="text-xs mb-1 block" style={{ color: '#6b7c74' }}>Email address</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full text-sm px-4 py-3 rounded-xl outline-none"
                  style={{ border: '1px solid #e0e0e0', background: '#fafafa' }}
                />
              </div>

              {error && (
                <p className="text-xs mb-3" style={{ color: '#a32d2d' }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 rounded-2xl text-white font-semibold text-sm"
                style={{
                  background: '#1e7a4c',
                  opacity: loading || !email ? 0.5 : 1,
                }}
              >
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
            </form>

            <p className="text-xs text-center mt-4" style={{ color: '#9eb3a4' }}>
              No password needed — we email you a secure link
            </p>
          </>
        )}
      </div>
    </div>
  )
}
