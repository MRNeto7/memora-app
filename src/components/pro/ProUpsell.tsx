'use client'

import { PRO_BENEFITS } from '@/lib/pro'
import Icon from '@/components/ui/Icon'

// "Coming soon" Pro pitch — shown wherever a gated feature is reached.
// The purchase button activates when in-app purchases land.
export default function ProUpsell({ feature }: { feature?: string }) {
  return (
    <div className="rise rounded-3xl p-6 text-center" style={{
      background: 'linear-gradient(165deg, #136570 0%, #0D4F57 60%, #0B454C 100%)',
      boxShadow: '0 8px 32px rgba(13,79,87,0.3)',
    }}>
      <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ background: 'rgba(201,168,106,0.18)', border: '0.5px solid rgba(201,168,106,0.4)' }}>
        <Icon name="sparkle" size={26} color="#C9A86A" strokeWidth={1.5} />
      </div>
      <h2 className="text-lg font-semibold text-white mb-1">Mimora Pro</h2>
      {feature && <p className="text-sm mb-4" style={{ color: '#C9A86A' }}>{feature} is a Pro feature</p>}

      <div className="text-left rounded-2xl p-4 mb-5" style={{ background: 'rgba(255,255,255,0.07)' }}>
        {PRO_BENEFITS.map(benefit => (
          <div key={benefit} className="flex items-start gap-2.5 mb-2.5 last:mb-0">
            <span className="flex-shrink-0 mt-1.5" style={{ width: 5, height: 5, borderRadius: '50%', background: '#C9A86A' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{benefit}</p>
          </div>
        ))}
      </div>

      <div className="px-6 py-3.5 rounded-2xl text-sm font-semibold"
        style={{ background: 'rgba(201,168,106,0.25)', color: '#C9A86A', border: '0.5px solid rgba(201,168,106,0.4)' }}>
        Coming soon
      </div>
    </div>
  )
}
