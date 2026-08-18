'use client'

interface Props {
  message: string
}

export default function Toast({ message }: Props) {
  return (
    <div style={{
      position: 'fixed', left: 24, bottom: 24, zIndex: 70,
      background: '#002744', color: 'rgba(255,255,255,0.96)', borderRadius: 10,
      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 16,
      boxShadow: '0 8px 24px -4px rgba(0,0,0,0.24)', fontFamily: "'Open Sans', sans-serif",
    }}>
      <span style={{ fontSize: 13 }}>{message}</span>
    </div>
  )
}
