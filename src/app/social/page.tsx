'use client'

export default function SocialPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#EAE5DD', paddingBottom: 80 }}>

      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6" style={{ background: '#0D4F57' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#C9A86A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>

      <h1 className="text-xl font-semibold mb-2" style={{ color: '#0D4F57' }}>Social is coming</h1>
      <p className="text-sm leading-relaxed mb-10" style={{ color: '#7D878D', maxWidth: 280 }}>
        Share your food map, follow friends, and discover where people you trust have eaten.
      </p>

      <div className="w-full max-w-sm text-left">
        {[
          { title: 'Public map', desc: 'Share your memory map with anyone — or keep it private.' },
          { title: 'Follow friends', desc: 'See your friends\' memories and get real recommendations.' },
          { title: 'Restaurant feeds', desc: 'See all public memories at a restaurant before you go.' },
          { title: 'Wishlists', desc: 'Share your restaurant wishlist and see where friends want to eat.' },
        ].map((item) => (
          <div key={item.title} className="flex gap-4 mb-5">
            <div className="w-1.5 flex-shrink-0 rounded-full mt-1" style={{ background: '#C9A86A', alignSelf: 'stretch', maxHeight: 40 }} />
            <div>
              <p className="text-sm font-semibold mb-0.5" style={{ color: '#0D4F57' }}>{item.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: '#7D878D' }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 px-6 py-3 rounded-2xl text-xs font-medium" style={{ background: 'rgba(201,168,106,0.15)', color: '#C9A86A', border: '0.5px solid rgba(201,168,106,0.3)' }}>
        Coming in a future update
      </div>
    </div>
  )
}
