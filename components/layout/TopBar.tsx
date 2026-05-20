'use client'

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function TopBar({ userName }: { userName: string }) {
  return (
    <header style={{
      height: 56,
      background: 'var(--navy-900)',
      color: 'var(--fg-on-brand)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-orah-symbol.svg" alt="Orah" style={{ height: 22 }} />
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.18)' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--fg-on-brand)' }}>
            Orah Ops Hub
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
            internal tools
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          borderRadius: 999,
          background: '#e9f5ed',
          color: '#067b31',
          fontWeight: 700,
          fontSize: 11,
          flexShrink: 0,
        }}>
          {initials(userName)}
        </span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.92)' }}>
          {userName}
        </span>
        <a
          href="/api/auth/logout"
          style={{
            marginLeft: 8,
            fontSize: 12,
            color: 'rgba(255,255,255,0.5)',
            textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4,
            padding: '2px 8px',
          }}
        >
          Sign out
        </a>
      </div>
    </header>
  )
}
