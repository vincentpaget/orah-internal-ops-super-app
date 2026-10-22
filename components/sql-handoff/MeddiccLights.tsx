'use client'

import type { SFSqlHandoffOpportunity } from '@/lib/sql-handoff/types'
import { MEDDICC_FIELDS } from '@/lib/sql-handoff/logic'

// One letter per MEDDICCC element, in order: Metrics, Economic Buyer, Decision Criteria,
// Decision Process, Identified Pain, Champion, Compelling Event, Competition.
const LETTERS = ['M', 'E', 'D', 'D', 'I', 'C', 'C', 'C']

const LIGHT: Record<string, { bg: string; fg: string }> = {
  Green:  { bg: '#43A047', fg: '#fff' },
  Yellow: { bg: '#FBC02D', fg: '#5D4300' },
  Red:    { bg: '#E53935', fg: '#fff' },
}
const UNSET = { bg: '#EEEEEE', fg: 'rgba(0,0,0,0.38)' }

// Traffic-light summary of an opportunity's MEDDICC grades. Clicking opens the MEDDICC pop-up.
export default function MeddiccLights({ opp, score, onClick }: { opp: SFSqlHandoffOpportunity; score: number; onClick: () => void }) {
  const summary = MEDDICC_FIELDS.map(m => `${m.label}: ${(opp[m.gradeField] as string | null) ?? 'Not set'}`).join('\n')
  return (
    <button
      onClick={onClick} title={`MEDDICC score ${score}%\n${summary}\n\nClick to view or edit`}
      style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 3, border: '1px solid transparent', borderRadius: 6, background: 'transparent', cursor: 'pointer' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#9CC9F5'; e.currentTarget.style.background = '#F5FAFF' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent' }}
    >
      {MEDDICC_FIELDS.map((m, i) => {
        const { bg, fg } = LIGHT[(opp[m.gradeField] as string | null) ?? ''] ?? UNSET
        return (
          <span key={m.key} style={{
            width: 15, height: 18, borderRadius: 3, background: bg, color: fg,
            display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, fontFamily: "'Open Sans', sans-serif",
          }}>
            {LETTERS[i]}
          </span>
        )
      })}
      <span style={{
        marginLeft: 6, minWidth: 34, textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        fontFamily: "'Open Sans', sans-serif", color: score >= 70 ? '#2E7D32' : score >= 40 ? '#B35C00' : '#D32F2F',
      }}>
        {score}%
      </span>
    </button>
  )
}
