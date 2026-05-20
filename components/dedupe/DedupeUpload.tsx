'use client'

import { useRef } from 'react'

interface Props {
  onFile: (text: string, filename: string) => void
}

export default function DedupeUpload({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => onFile(e.target?.result as string, file.name)
    reader.readAsText(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      style={{
        border: '2px dashed var(--border-strong)',
        borderRadius: 10,
        padding: '48px 32px',
        textAlign: 'center',
        cursor: 'pointer',
        background: 'var(--bg-subtle)',
        transition: 'background 150ms',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-canvas)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 6 }}>
        Drop a CSV file here, or click to browse
      </div>
      <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>
        Expected columns: <code>id, name, domain, sf_id, hs_id, owner, owner_email, deal_count, contact_count, cluster_id</code>
      </div>
    </div>
  )
}
