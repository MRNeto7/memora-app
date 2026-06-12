'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import FriendMemories from '@/components/social/FriendMemories'

interface FriendProfile {
  friend_id: string
  memora_id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  memory_count: number
}

interface FriendRequest {
  id: string
  from_user_id: string
  status: string
  from_user: { memora_id: string; display_name: string | null }
}

export default function SocialPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'friends' | 'requests' | 'find'>('friends')
  const [friends, setFriends] = useState<FriendProfile[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [myMimoraId, setMyMimoraId] = useState<string>('')
  const [searchId, setSearchId] = useState('')
  const [searchResult, setSearchResult] = useState<{ id: string; memora_id: string; display_name: string | null } | null>(null)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  async function fetchAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase.from('users').select('memora_id').eq('id', user.id).single()
    if (profile?.memora_id) setMyMimoraId(profile.memora_id)

    const { data: friendReqs, error: reqError } = await supabase
      .from('friend_requests')
      .select('id, from_user_id, to_user_id, status')
      .eq('status', 'accepted')
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)

    if (reqError) { setLoadError(true); setLoading(false); return }

    if (friendReqs && friendReqs.length > 0) {
      const friendIds = friendReqs.map(r =>
        r.from_user_id === user.id ? r.to_user_id : r.from_user_id
      )
      const { data: profiles } = await supabase.from('users').select('id, memora_id, display_name, username').in('id', friendIds)
      if (profiles) {
        const withCounts = await Promise.all(profiles.map(async p => {
          const { count } = await supabase.from('memories').select('id', { count: 'exact', head: true }).eq('user_id', p.id).eq('is_public', true)
          return { friend_id: p.id, memora_id: p.memora_id ?? '', display_name: p.display_name, username: p.username, avatar_url: null, memory_count: count ?? 0 }
        }))
        setFriends(withCounts)
      }
    }

    const { data: incoming } = await supabase
      .from('friend_requests')
      .select('id, from_user_id, status, from_user:users!from_user_id(memora_id, display_name)')
      .eq('to_user_id', user.id)
      .eq('status', 'pending')

    if (incoming) {
      setRequests(incoming.map(r => ({ ...r, from_user: { ...r.from_user, memora_id: r.from_user.memora_id ?? '' } })))
    }
    setLoading(false)
  }

  function retryFetch() {
    setLoading(true)
    setLoadError(false)
    fetchAll()
  }

  useEffect(() => {
    const load = async () => { await fetchAll() }
    load()
  }, [])

  async function handleSearch() {
    if (!searchId.trim()) return
    setSearching(true); setSearchError(''); setSearchResult(null)
    const { data } = await supabase.from('users').select('id, memora_id, display_name').eq('memora_id', searchId.trim().toUpperCase()).single()
    if (data) setSearchResult({ ...data, memora_id: data.memora_id ?? '' })
    else setSearchError('No user found with that Mimora ID.')
    setSearching(false)
  }

  async function sendRequest(toUserId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('friend_requests').insert({ from_user_id: user.id, to_user_id: toUserId })
    if (!error) { setSearchResult(null); setSearchId(''); alert('Friend request sent!') }
  }

  async function respondRequest(id: string, accept: boolean) {
    await supabase.from('friend_requests').update({ status: accept ? 'accepted' : 'declined' }).eq('id', id)
    fetchAll()
  }

  function copyMimoraId() {
    navigator.clipboard.writeText(myMimoraId)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  if (selectedFriend) return <FriendMemories friend={selectedFriend} onBack={() => setSelectedFriend(null)} />

  return (
    <div className="page-enter min-h-screen flex flex-col" style={{ background: '#EAE5DD', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="page-header" style={{ paddingBottom: 0 }}>
        <div className="px-5 mb-4">
          <h1 className="text-xl font-semibold text-white">Social</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{friends.length} {friends.length === 1 ? 'friend' : 'friends'}</p>
        </div>

        {myMimoraId && (
          <div className="mx-5 mb-4 px-4 py-3 rounded-2xl flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div>
              <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Your Mimora ID</p>
              <p className="text-xl font-bold tracking-widest text-white">{myMimoraId}</p>
            </div>
            <button onClick={copyMimoraId} className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{ background: copySuccess ? '#C9A86A' : 'rgba(255,255,255,0.15)', color: '#fff' }}>
              {copySuccess ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}

        <div className="flex px-5 gap-1">
          {(['friends', 'requests', 'find'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2.5 text-sm font-medium rounded-t-xl capitalize transition-all"
              style={{ background: tab === t ? '#EAE5DD' : 'transparent', color: tab === t ? '#0D4F57' : 'rgba(255,255,255,0.6)' }}>
              {t === 'requests' ? (requests.length > 0 ? `Requests (${requests.length})` : 'Requests') : t === 'friends' ? `Friends (${friends.length})` : 'Find friends'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 flex-1">
        {tab === 'friends' && (
          loading ? <div className="flex justify-center py-20"><p className="text-sm" style={{ color: '#7D878D' }}>Loading…</p></div> :
          loadError ? (
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
              <h2 className="font-semibold text-base mb-2" style={{ color: '#0D4F57' }}>Couldn&apos;t load your friends</h2>
              <p className="text-sm mb-4" style={{ color: '#7D878D' }}>Check your connection and try again</p>
              <button onClick={retryFetch} className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#0D4F57', color: '#EAE5DD' }}>
                Retry
              </button>
            </div>
          ) :
          friends.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#0D4F57' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A86A" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <h2 className="font-semibold text-base mb-2" style={{ color: '#0D4F57' }}>No friends yet</h2>
              <p className="text-sm mb-4" style={{ color: '#7D878D', maxWidth: 240 }}>Share your Mimora ID or search for friends</p>
              <button onClick={() => setTab('find')} className="px-5 py-2.5 rounded-2xl text-sm font-semibold" style={{ background: '#0D4F57', color: '#EAE5DD' }}>Find friends</button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {friends.map(f => (
                <button key={f.friend_id} onClick={() => setSelectedFriend(f)}
                  className="w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-4"
                  style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(13,79,87,0.06)' }}>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#0D4F57' }}>
                    <span className="text-white font-semibold text-sm">{(f.display_name ?? f.memora_id).slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm" style={{ color: '#0D4F57' }}>{f.display_name ?? f.memora_id}</p>
                    <p className="text-xs" style={{ color: '#7D878D' }}>{f.memora_id} · {f.memory_count} public {f.memory_count === 1 ? 'memory' : 'memories'}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b0babe" strokeWidth="1.5"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              ))}
            </div>
          )
        )}

        {tab === 'requests' && (
          requests.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="font-semibold text-base mb-1" style={{ color: '#0D4F57' }}>No pending requests</p>
              <p className="text-sm" style={{ color: '#7D878D' }}>Requests from friends appear here</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {requests.map(req => (
                <div key={req.id} className="rounded-2xl px-4 py-3.5" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(13,79,87,0.06)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#0D4F57' }}>
                      <span className="text-white font-semibold text-sm">{(req.from_user?.display_name ?? req.from_user?.memora_id ?? '?').slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: '#0D4F57' }}>{req.from_user?.display_name ?? req.from_user?.memora_id}</p>
                      <p className="text-xs" style={{ color: '#7D878D' }}>Wants to connect on Mimora</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => respondRequest(req.id, true)} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background: '#0D4F57', color: '#EAE5DD' }}>Accept</button>
                    <button onClick={() => respondRequest(req.id, false)} className="flex-1 py-2 rounded-xl text-xs font-medium" style={{ background: '#f5f2ed', color: '#7D878D' }}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'find' && (
          <div>
            <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', border: '0.5px solid rgba(255,255,255,0.65)', boxShadow: '0 2px 12px rgba(13,79,87,0.06)' }}>
              <label className="text-xs font-medium block mb-2" style={{ color: '#7D878D' }}>Search by Mimora ID</label>
              <div className="flex gap-2">
                <input type="text" placeholder="e.g. MA4829" value={searchId}
                  onChange={e => setSearchId(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="flex-1 text-sm px-4 py-2.5 rounded-xl outline-none"
                  style={{ border: '1.5px solid #EAE5DD', background: '#fafaf9', letterSpacing: 2, fontWeight: 600, color: '#0D4F57' }} />
                <button onClick={handleSearch} disabled={searching || !searchId.trim()}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: '#0D4F57', color: '#EAE5DD', opacity: searching || !searchId.trim() ? 0.5 : 1 }}>
                  {searching ? '…' : 'Find'}
                </button>
              </div>
              {searchError && <p className="text-xs mt-2" style={{ color: '#a32d2d' }}>{searchError}</p>}
              {searchResult && (
                <div className="mt-3 pt-3 flex items-center gap-3" style={{ borderTop: '0.5px solid #f0ede8' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#0D4F57' }}>
                    <span className="text-white font-semibold text-sm">{(searchResult.display_name ?? searchResult.memora_id).slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm" style={{ color: '#0D4F57' }}>{searchResult.display_name ?? searchResult.memora_id}</p>
                    <p className="text-xs" style={{ color: '#7D878D' }}>{searchResult.memora_id}</p>
                  </div>
                  <button onClick={() => sendRequest(searchResult.id)} className="px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: '#C9A86A', color: '#fff' }}>Add</button>
                </div>
              )}
            </div>
            <div className="rounded-2xl p-4" style={{ background: 'rgba(201,168,106,0.1)', border: '0.5px solid rgba(201,168,106,0.25)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: '#C9A86A' }}>How Mimora IDs work</p>
              {['Each user has a unique ID like MA4829', 'Share yours so friends can find you', 'Friends see your public memories and wishlist', 'Control privacy in your Profile settings'].map(text => (
                <div key={text} className="flex items-start gap-2 mb-1.5">
                  <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#C9A86A' }} />
                  <p className="text-xs" style={{ color: '#7D878D' }}>{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
