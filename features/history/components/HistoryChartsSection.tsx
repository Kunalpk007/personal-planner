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
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg)] p-3.5 mb-3">
      <div className="flex gap-1 mb-3 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-[12px] px-2.5 py-1.5 rounded-full border ${
              tab === t.key
                ? 'bg-[var(--green-mid)] text-white border-[var(--green-mid)]'
                : 'border-[var(--border2)] text-[var(--text2)]'
            }`}
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
