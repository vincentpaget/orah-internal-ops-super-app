'use client'

import { useState } from 'react'
import TopBar from './TopBar'
import NavBar from './NavBar'

export default function AppShell({ userName, lockedHrefs = [], children }: {
  userName: string
  /** Tools the user can't open; hidden from the sidebar. */
  lockedHrefs?: string[]
  children: React.ReactNode
}) {
  const [navCollapsed, setNavCollapsed] = useState(true)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-subtle)', fontFamily: 'var(--font-sans)' }}>
      <TopBar userName={userName} />
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        <NavBar collapsed={navCollapsed} onToggle={() => setNavCollapsed(c => !c)} lockedHrefs={lockedHrefs} />
        <main style={{ flex: 1, padding: '32px 40px 64px', minWidth: 0, overflowX: 'clip' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
