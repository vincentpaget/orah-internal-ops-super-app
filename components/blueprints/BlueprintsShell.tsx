'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Blueprint } from '@/lib/blueprints'

const STORAGE_KEY = 'blueprints-list-collapsed'
const CHANGE_EVENT = 'blueprints-list-collapsed-change'

// Collapse state is a per-browser preference kept in localStorage.
function readCollapsed() {
  try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
}
function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

function ChevronIcon({ pointLeft }: { pointLeft: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: pointLeft ? 'none' : 'rotate(180deg)' }}>
      <path d="M10 3.5L5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// List of blueprints on the left (collapsible), selected blueprint on the right.
// Lives in the blueprints layout, so it stays mounted while switching blueprints.
export default function BlueprintsShell({ blueprints, children }: { blueprints: Blueprint[]; children: ReactNode }) {
  const pathname = usePathname()
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false)

  function toggle() {
    try { localStorage.setItem(STORAGE_KEY, collapsed ? '0' : '1') } catch {}
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }

  const toggleButton = (
    <button
      onClick={toggle}
      title={collapsed ? 'Show blueprint list' : 'Hide blueprint list'}
      aria-label={collapsed ? 'Show blueprint list' : 'Hide blueprint list'}
      style={{
        width: 28, height: 28, display: 'grid', placeItems: 'center', flexShrink: 0,
        border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)',
        color: 'var(--fg-3)', cursor: 'pointer',
      }}
    >
      <ChevronIcon pointLeft={!collapsed} />
    </button>
  )

  return (
    // Negative margins escape AppShell's padding: '32px 40px 64px', so the layout fills the page.
    <div style={{ margin: '-32px -40px -64px', display: 'flex', height: 'calc(100vh - 56px)' }}>
      <aside style={{
        width: collapsed ? 48 : 280, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg)',
        display: 'flex', flexDirection: 'column', transition: 'width 150ms', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
          gap: 8, padding: collapsed ? '12px 0' : '12px 12px 12px 16px', borderBottom: '1px solid var(--border)',
        }}>
          {!collapsed && (
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--navy-900)', whiteSpace: 'nowrap' }}>
              GTM Blueprints
            </span>
          )}
          {toggleButton}
        </div>

        {!collapsed && (
          <nav style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {blueprints.map(b => {
              const active = pathname === `/blueprints/${b.slug}`
              return (
                <Link
                  key={b.slug}
                  href={`/blueprints/${b.slug}`}
                  style={{
                    display: 'block', textDecoration: 'none', padding: '10px 12px', borderRadius: 6,
                    background: active ? 'var(--blue-50)' : 'transparent',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: active ? 'var(--navy-900)' : 'var(--fg-1)' }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.45, marginTop: 2 }}>{b.description}</div>
                </Link>
              )
            })}
          </nav>
        )}
      </aside>

      <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </section>
    </div>
  )
}
