'use client'

import { useState } from 'react'
import type { Opportunity } from '@/lib/types'

interface Props {
  opps: Opportunity[]
}

export default function UnmappedStagesBanner({ opps }: Props) {
  const [open, setOpen] = useState(false)
  const stages = [...new Set(opps.map(o => o.StageName as string))]
  const count = opps.length

  return (
    <div style={{
      marginBottom: 20,
      borderRadius: 8,
      background: '#fffbeb',
      border: '1px solid rgba(217,119,6,0.25)',
      color: '#b45309',
      fontSize: 13,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '12px 16px',
          background: 'none',
          border: 'none',
          color: '#b45309',
          fontSize: 13,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          gap: 12,
        }}
      >
        <span>
          <strong>Unknown stages</strong> — {count} opportunit{count === 1 ? 'y' : 'ies'} excluded:{' '}
          {stages.map((s, i) => (
            <span key={s}>
              <code style={{ background: 'rgba(217,119,6,0.1)', padding: '1px 5px', borderRadius: 4 }}>{s}</code>
              {i < stages.length - 1 ? ', ' : ''}
            </span>
          ))}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 12 12" fill="none"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
        >
          <path d="M2 4l4 4 4-4" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid rgba(217,119,6,0.2)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(217,119,6,0.06)' }}>
                <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: '#92400e' }}>Account</th>
                <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: '#92400e' }}>Stage</th>
                <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: '#92400e' }}>Close Date</th>
              </tr>
            </thead>
            <tbody>
              {opps.map(opp => (
                <tr key={opp.Id} style={{ borderTop: '1px solid rgba(217,119,6,0.12)' }}>
                  <td style={{ padding: '9px 16px' }}>
                    <a
                      href={`https://orah.lightning.force.com/lightning/r/Opportunity/${opp.Id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#d97706', fontWeight: 600, textDecoration: 'none' }}
                    >
                      {opp['Account.Name'] || opp.Name}
                    </a>
                  </td>
                  <td style={{ padding: '9px 16px' }}>
                    <code style={{ background: 'rgba(217,119,6,0.1)', padding: '1px 5px', borderRadius: 4 }}>{opp.StageName}</code>
                  </td>
                  <td style={{ padding: '9px 16px', color: '#92400e' }}>{opp.CloseDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
