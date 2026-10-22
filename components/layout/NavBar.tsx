'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType } from 'react'
import { TOOL_GROUPS, TOOLS, matchesTool } from '@/lib/tools'
import { TOOL_ICONS, HomeIcon, AdminIcon } from './ToolIcons'

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ transition: 'transform 200ms', transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
    >
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

interface Props {
  collapsed: boolean
  onToggle: () => void
  /** Tools the user can't open; hidden from the sidebar. */
  lockedHrefs: string[]
}

function NavLink({ href, label, Icon, active, collapsed }: {
  href: string
  label: string
  Icon: ComponentType<{ color: string }>
  active: boolean
  collapsed: boolean
}) {
  return (
    <Link
      href={href}
      title={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 10,
        padding: '7px 8px',
        borderRadius: 6,
        textDecoration: 'none',
        fontSize: 14,
        background: active ? 'var(--blue-50)' : 'transparent',
        color: active ? 'var(--navy-900)' : 'var(--fg-2)',
        fontWeight: active ? 600 : 500,
        borderLeft: `3px solid ${active ? 'var(--navy-900)' : 'transparent'}`,
        transition: 'background 120ms, color 120ms',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <Icon color={active ? 'var(--navy-900)' : 'var(--fg-3)'} />
      {!collapsed && <span>{label}</span>}
    </Link>
  )
}

// Collapsed: a thin rule stands in for the heading, keeping groups visually separate.
function GroupHeading({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return <div style={{ borderTop: '1px solid var(--border)', margin: '10px 8px 6px' }} />
  }
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      color: 'var(--fg-3)', padding: '16px 11px 6px', whiteSpace: 'nowrap', overflow: 'hidden',
    }}>
      {label}
    </div>
  )
}

export default function NavBar({ collapsed, onToggle, lockedHrefs }: Props) {
  const pathname = usePathname()
  const visible = TOOLS.filter(t => !lockedHrefs.includes(t.href))

  return (
    <nav data-print-hide style={{
      width: collapsed ? 56 : 220,
      background: 'var(--bg)',
      borderRight: '1px solid var(--border)',
      padding: '16px 8px',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 56,
      height: 'calc(100vh - 56px)',
      flexShrink: 0,
      overflowY: 'auto',
      overflowX: 'hidden',
      transition: 'width 200ms ease',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <NavLink href="/" label="Home" Icon={HomeIcon} active={pathname === '/'} collapsed={collapsed} />

        {TOOL_GROUPS.map(group => {
          const tools = visible.filter(t => t.group === group.key)
          if (tools.length === 0) return null
          return (
            <div key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <GroupHeading label={group.label} collapsed={collapsed} />
              {tools.map(t => (
                <NavLink
                  key={t.href}
                  href={t.href}
                  label={t.navLabel}
                  Icon={TOOL_ICONS[t.icon]}
                  active={matchesTool(t.href, pathname)}
                  collapsed={collapsed}
                />
              ))}
            </div>
          )
        })}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0', paddingTop: 8 }}>
        <NavLink href="/admin" label="Admin" Icon={AdminIcon} active={matchesTool('/admin', pathname)} collapsed={collapsed} />
      </div>

      <button
        onClick={onToggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-end',
          gap: 6,
          padding: '8px',
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          color: 'var(--fg-3)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 12,
          width: '100%',
          transition: 'color 120ms',
        }}
      >
        <ChevronIcon collapsed={collapsed} />
      </button>
    </nav>
  )
}
