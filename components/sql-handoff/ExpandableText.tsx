'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'

interface Props {
  text: string | null | undefined
  style?: CSSProperties
}

const BASE: CSSProperties = { fontSize: 12, color: 'rgba(0,0,0,0.54)', lineHeight: '17px' }

export default function ExpandableText({ text, style = BASE }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!text) return <span style={style}>—</span>

  return (
    <div
      onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
      title={expanded ? undefined : text}
      style={{ cursor: 'pointer' }}
    >
      <span
        style={{
          ...style,
          display: expanded ? 'block' : '-webkit-box',
          WebkitLineClamp: expanded ? undefined : 2,
          WebkitBoxOrient: expanded ? undefined : 'vertical',
          overflow: expanded ? 'visible' : 'hidden',
          whiteSpace: expanded ? 'pre-wrap' : 'normal',
        }}
      >
        {text}
      </span>
    </div>
  )
}
