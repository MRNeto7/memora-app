'use client'

import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen" style={{ background: '#EAE5DD', paddingBottom: 'var(--nav-total)' }}>
      <div className="px-5 pb-5" style={{ background: '#0D4F57', paddingTop: 'calc(var(--safe-top) + 16px)' }}>
        <div className="flex items-center gap-3">
          <Link href="/profile" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </Link>
          <h1 className="text-xl font-semibold text-white">Privacy policy</h1>
        </div>
        <p className="text-xs mt-2 ml-12" style={{ color: 'rgba(255,255,255,0.5)' }}>Last updated: June 2026</p>
      </div>

      <div className="px-5 pt-5 space-y-5">
        {[
          {
            title: 'What we collect',
            body: `Mimora collects the following information to provide the service:

• Your email address and password (for authentication)
• Photos and videos you choose to upload
• Location data embedded in your photos (EXIF metadata)
• Ratings, notes, and dish names you add to memories
• Restaurant wishlist entries
• Your unique Mimora ID and display name`
          },
          {
            title: 'How we use your data',
            body: `Your data is used solely to provide the Mimora service:

• Photos are stored securely and only accessible to you unless you choose to make memories public
• Location data is used to pin memories on your map
• We do not sell, share, or monetise your personal data
• We do not serve advertising based on your data`
          },
          {
            title: 'Photo privacy',
            body: `Photos are stored in private, encrypted buckets. Access is controlled by signed URLs that expire after one hour. Raw EXIF location data is never exposed publicly — if you make a memory public, the pin shows a neighbourhood-level location only (coordinates rounded to ~1km).`
          },
          {
            title: 'Social features',
            body: `When you connect with friends on Mimora, they can only see memories and wishlists you have explicitly made public via your Privacy settings. Your email address is never shared with other users. Your Mimora ID (e.g. MA4829) is the only identifier visible to friends.`
          },
          {
            title: 'Data retention',
            body: `Your data is retained for as long as you have an active Mimora account. You can delete your account at any time from Account Settings, which will permanently remove all your memories, photos, and personal data within 30 days.`
          },
          {
            title: 'Third-party services',
            body: `Mimora uses the following third-party services:

• Supabase — database and file storage (EU region)
• Google Maps & Places API — map display and restaurant search
• Vercel — web hosting

Each of these services has their own privacy policies. We use them only as necessary to deliver the Mimora service.`
          },
          {
            title: 'Contact',
            body: `For any privacy-related questions or data deletion requests, contact us at privacy@mimora.app`
          },
        ].map(section => (
          <div key={section.title} className="rounded-2xl p-4" style={{ background: '#fff', border: '0.5px solid rgba(13,79,87,0.08)' }}>
            <p className="font-semibold text-sm mb-2" style={{ color: '#0D4F57' }}>{section.title}</p>
            <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#7D878D' }}>{section.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
