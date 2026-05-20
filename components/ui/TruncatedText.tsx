'use client'

import { useState } from 'react'

interface Props {
  text: string | null | undefined
  fallback?: React.ReactNode
}

export default function TruncatedText({ text, fallback }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!text) return <>{fallback ?? <span style={{ color: 'var(--fg-3)' }}>—</span>}</>

  return (
    <div
      onClick={(e) => { e.stopPropagation(); setExpanded(x => !x) }}
      title={expanded ? undefined : text}
      style={{ cursor: 'pointer' }}
    >
      <span style={(!expanded ? {
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      } : {}) as React.CSSProperties}>
        {text}
      </span>
    </div>
  )
}
