'use client'

import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: '#EAE5DD', paddingBottom: 'var(--nav-total)' }}>
      <div className="px-5 pb-5" style={{ background: '#0D4F57', paddingTop: 'calc(var(--safe-top) + 16px)' }}>
        <div className="flex items-center gap-3">
          <Link href="/profile" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </Link>
          <h1 className="text-xl font-semibold text-white">Terms of service</h1>
        </div>
        <p className="text-xs mt-2 ml-12" style={{ color: 'rgba(255,255,255,0.5)' }}>Last updated: June 2026</p>
      </div>

      <div className="px-5 pt-5 space-y-5">
        {[
          {
            title: '1. Acceptance',
            body: `By using Mimora, you agree to these Terms of Service. If you do not agree, please do not use the app. We may update these terms from time to time and will notify you of material changes.`
          },
          {
            title: '2. Your account',
            body: `You are responsible for maintaining the security of your account. You must be 13 years or older to use Mimora. One account per person — creating multiple accounts to circumvent restrictions is prohibited.`
          },
          {
            title: '3. Your content',
            body: `You retain ownership of all photos, notes, and memories you upload to Mimora. By uploading, you grant us a limited licence to store and display your content solely for the purpose of providing the Mimora service to you.

You agree not to upload content that:
• Infringes third-party intellectual property rights
• Contains illegal material
• Harasses or harms other users`
          },
          {
            title: '4. Social features',
            body: `When you make memories or wishlists public, other Mimora users can view them. You control this through your Privacy settings. You can make content private again at any time. You are responsible for the content you share publicly.`
          },
          {
            title: '5. Service availability',
            body: `We aim to provide a reliable service but cannot guarantee 100% uptime. We reserve the right to modify or discontinue features with reasonable notice. We are not liable for any data loss, though we maintain regular backups.`
          },
          {
            title: '6. Termination',
            body: `You may delete your account at any time from Account Settings. We may suspend or terminate accounts that violate these terms. Upon termination, your data will be permanently deleted within 30 days.`
          },
          {
            title: '7. Liability',
            body: `Mimora is provided "as is". We are not liable for indirect, incidental, or consequential damages arising from your use of the service. Our total liability is limited to the amount you paid to use the service (if any) in the past 12 months.`
          },
          {
            title: '8. Governing law',
            body: `These terms are governed by the laws of England and Wales. Any disputes will be resolved in the courts of England and Wales.`
          },
          {
            title: 'Contact',
            body: `For questions about these terms, contact us at legal@mimora.app`
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
