'use client'
import { useState }        from 'react'
import { useDayKey }       from '@/hooks/useDayKey'
import { usePlannerStore } from '@/store'
import { Accordion }       from '@/ui/Accordion'
import { showToast }       from '@/ui/Toast'
import { PinGate }         from '@/ui/PinGate'

export default function JournalPage() {
  const { today }   = useDayKey()
  const [mode, setMode] = useState<'write' | 'history'>('write')
  const [text, setText] = useState('')
  const [editKey, setEditKey]   = useState<string | null>(null)

  const journal     = usePlannerStore(s => s.journal)
  const saveEntry   = usePlannerStore(s => s.saveJournalEntry)
  const deleteEntry = usePlannerStore(s => s.deleteJournalEntry)

  const todayEntries = Object.keys(journal).filter(k => k.startsWith(today))

  function handleSave() {
    if (!text.trim()) { showToast('Write something first.'); return }
    const { isFirst } = saveEntry(today, text.trim(), editKey ?? undefined)
    setText('')
    setEditKey(null)
    showToast(editKey ? 'Entry updated.' : isFirst ? '+5 Rank XP for journaling!' : 'Entry saved.')
  }

  function handleEdit(key: string) {
    setText(journal[key] ?? '')
    setEditKey(key)
    setMode('write')
  }

  // Group by day prefix
  const allKeys  = Object.keys(journal).sort().reverse()
  const byDay: Record<string, string[]> = {}
  const dayOrder: string[] = []
  allKeys.forEach(k => {
    const day = k.slice(0, 10)
    if (!byDay[day]) { byDay[day] = []; dayOrder.push(day) }
    byDay[day].push(k)
  })

  return (
    <PinGate title="Journal PIN">
    <div>
      <div className="inline-flex bg-[var(--bg3)] rounded-[10px] p-1 mb-3.5">
        {[{k:'write',l:'Write'},{k:'history',l:'Past entries'}].map(m => (
          <button key={m.k} onClick={() => setMode(m.k as any)}
            className={`px-4 py-1.5 text-[13px] font-medium rounded-[7px] transition-all ${mode === m.k ? 'bg-[var(--bg)] text-[var(--text)] shadow-sm' : 'text-[var(--text2)]'}`}>
            {m.l}
          </button>
        ))}
      </div>

      {mode === 'write' && (
        <>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">
            {editKey ? `Editing: ${editKey.slice(0, 10)} at ${editKey.slice(11)}` : `Today's entry — ${today}`}
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="What's on your mind today? Thoughts, wins, blockers, reflections..."
            className="w-full min-h-[140px] text-[13px] p-3 rounded-[10px] border border-[var(--border2)] bg-[var(--bg)] text-[var(--text)] outline-none font-sans leading-relaxed resize-y"
          />
          <div className="flex gap-2 mt-2.5 items-center flex-wrap">
            <button onClick={handleSave} className="px-3.5 py-2 rounded-md text-xs font-medium bg-[var(--green-bg)] text-[var(--green)] border border-[var(--green-mid)]">
              {editKey ? 'Update entry' : 'Save entry (+5 XP)'}
            </button>
            <button
              onClick={() => { setText(''); setEditKey(null) }}
              className="px-3.5 py-2 rounded-md text-xs font-medium border border-[var(--border2)] bg-[var(--bg2)] text-[var(--text)]"
            >
              ↺ Reset
            </button>
            {todayEntries.length > 0 && (
              <span className="text-xs text-[var(--text3)]">
                Saved {todayEntries.length} entr{todayEntries.length === 1 ? 'y' : 'ies'} today ✓
              </span>
            )}
          </div>
        </>
      )}

      {mode === 'history' && (
        <>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)] mb-2">All journal entries</div>
          {dayOrder.length === 0 && <div className="text-[13px] text-[var(--text3)] py-3.5 text-center">No entries yet.</div>}
          {dayOrder.map(day => (
            <Accordion key={day} title={<span className="font-semibold">{day} <span className="text-[11px] text-[var(--text3)] font-normal ml-2">{byDay[day].length} entr{byDay[day].length === 1 ? 'y' : 'ies'}</span></span>}>
              {byDay[day].map(key => (
                <div key={key} className="border-t border-[var(--border)] py-2.5">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] text-[var(--text3)] font-semibold">{key.slice(11) || key}</span>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleEdit(key)} className="btn-icon">✏</button>
                      <button onClick={() => { deleteEntry(key); showToast('Entry deleted.') }} className="btn-icon danger">🗑</button>
                    </div>
                  </div>
                  <p className="text-[13px] text-[var(--text2)] leading-relaxed whitespace-pre-wrap">{journal[key]}</p>
                </div>
              ))}
            </Accordion>
          ))}
        </>
      )}
    </div>
    </PinGate>
  )
}
