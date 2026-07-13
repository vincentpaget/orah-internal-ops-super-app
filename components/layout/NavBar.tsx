'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--navy-900)' : 'var(--fg-3)'
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 18v-6h6v6" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function PipelineIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--navy-900)' : 'var(--fg-3)'
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="3" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="15" cy="9" r="2.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 17c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13.5 16c0-1.8 1.4-3.3 3-3.3s3 1.5 3 3.3" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function DedupeIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--navy-900)' : 'var(--fg-3)'
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <rect x="2" y="3" width="7" height="5" rx="1.5" stroke={c} strokeWidth="1.6"/>
      <rect x="11" y="3" width="7" height="5" rx="1.5" stroke={c} strokeWidth="1.6"/>
      <path d="M5.5 8v2.5M14.5 8v2.5M5.5 10.5h9M10 10.5V14" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
      <rect x="6.5" y="14" width="7" height="4" rx="1.5" stroke={c} strokeWidth="1.6"/>
    </svg>
  )
}

function EventLeadsIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--navy-900)' : 'var(--fg-3)'
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <rect x="3" y="3" width="14" height="14" rx="2" stroke={c} strokeWidth="1.6"/>
      <path d="M7 3v3M13 3v3M3 9h14" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M7 13h2M7 16h4" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="14" cy="14.5" r="3" fill={c} fillOpacity="0.12" stroke={c} strokeWidth="1.4"/>
      <path d="M13 14.5l1 1 2-1.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function CampaignIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--navy-900)' : 'var(--fg-3)'
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 7h14v9a1 1 0 01-1 1H4a1 1 0 01-1-1V7z" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 7l7-4 7 4" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 7l7 5 7-5" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function CsPipelineIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--navy-900)' : 'var(--fg-3)'
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M4 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M10 8V4M10 4l-2 2M10 4l2 2" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="10" cy="15" r="1.5" fill={c}/>
      <path d="M6.5 17h7" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

function PricingMigrationIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--navy-900)' : 'var(--fg-3)'
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 14h14M3 10h14M3 6h14" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="6" cy="6" r="1.5" fill={c}/>
      <circle cx="10" cy="10" r="1.5" fill={c}/>
      <circle cx="15" cy="14" r="1.5" fill={c}/>
    </svg>
  )
}

function AdminIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--navy-900)' : 'var(--fg-3)'
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="7" stroke={c} strokeWidth="1.6"/>
      <circle cx="10" cy="10" r="2.5" stroke={c} strokeWidth="1.6"/>
      <path d="M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17M5.05 5.05l1.06 1.06M13.89 13.89l1.06 1.06M14.95 5.05l-1.06 1.06M6.11 13.89l-1.06 1.06" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

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

const NAV_ITEMS = [
  { href: '/', label: 'Home', Icon: HomeIcon, match: (p: string) => p === '/' },
  { href: '/pipeline', label: 'Pipeline Review', Icon: PipelineIcon, match: (p: string) => p.startsWith('/pipeline') },
  { href: '/cs-pipeline', label: 'CS Pipeline', Icon: CsPipelineIcon, match: (p: string) => p.startsWith('/cs-pipeline') },
  { href: '/campaign-setup', label: 'Campaign Setup', Icon: CampaignIcon, match: (p: string) => p.startsWith('/campaign-setup') },
  { href: '/dedupe', label: 'CRM Dedupe', Icon: DedupeIcon, match: (p: string) => p.startsWith('/dedupe') },
  { href: '/event-leads', label: 'Event Lead Pipeline', Icon: EventLeadsIcon, match: (p: string) => p.startsWith('/event-leads') },
  { href: '/pricing-migration', label: 'Pricing Migration', Icon: PricingMigrationIcon, match: (p: string) => p.startsWith('/pricing-migration') },
]

const ADMIN_ITEMS = [
  { href: '/admin', label: 'Admin', Icon: AdminIcon, match: (p: string) => p.startsWith('/admin') },
]

interface Props {
  collapsed: boolean
  onToggle: () => void
}

export default function NavBar({ collapsed, onToggle }: Props) {
  const pathname = usePathname()

  return (
    <nav style={{
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
        {NAV_ITEMS.map(({ href, label, Icon, match }) => {
          const active = match(pathname)
          return (
            <Link
              key={href}
              href={href}
              title={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: collapsed ? 0 : 10,
                padding: '8px',
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
              <Icon active={active} />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}

        <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />

        {ADMIN_ITEMS.map(({ href, label, Icon, match }) => {
          const active = match(pathname)
          return (
            <Link
              key={href}
              href={href}
              title={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: collapsed ? 0 : 10,
                padding: '8px',
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
              <Icon active={active} />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
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
