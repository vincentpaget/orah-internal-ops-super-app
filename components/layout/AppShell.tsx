'use client'

import { useState } from 'react'
import TopBar from './TopBar'
import NavBar from './NavBar'

export default function AppShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const [navCollapsed, setNavCollapsed] = useState(true)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-subtle)', fontFamily: 'var(--font-sans)' }}>
      <TopBar userName={userName} />
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        <NavBar collapsed={navCollapsed} onToggle={() => setNavCollapsed(c => !c)} />
        <main style={{ flex: 1, padding: '32px 40px 64px', minWidth: 0, overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
