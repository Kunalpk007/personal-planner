'use client'
import { useState } from 'react'
import { DailyTrendChart }      from './DailyTrendChart'
import { ZoneBreakdownChart }   from './ZoneBreakdownChart'

const TABS = [
  { key: 'trend',  label: '📈 Trend' },
  { key: 'zones',  label: '🧭 Zones' },
] as const

type TabKey = typeof TABS[number]['key']

/** Default export so this can be lazy-loaded via next/dynamic without adding
 *  chart weight to the main history page bundle when the feature flag is off. */
export default function HistoryChartsSection() {
  const [tab, setTab] = useState<TabKey>('trend')

  return (
    <div className="vx-tile p-3.5 mb-3">
      <div className="flex gap-1 mb-3 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`vx-pill text-[12px] ${tab === t.key ? 'vx-tinted' : ''}`}
            data-tone={tab === t.key ? 'emerald' : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'trend' && <DailyTrendChart />}
      {tab === 'zones' && <ZoneBreakdownChart />}
    </div>
  )
}
