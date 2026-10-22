// Line icons for the hub's tools (20x20, 1.6 stroke). Shared by the sidebar and the home page.
import type { ComponentType } from 'react'
import type { IconKey } from '@/lib/tools'

type IconProps = { color: string }

export function HomeIcon({ color: c }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 18v-6h6v6" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function PipelineIcon({ color: c }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="3" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="15" cy="9" r="2.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 17c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13.5 16c0-1.8 1.4-3.3 3-3.3s3 1.5 3 3.3" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function DedupeIcon({ color: c }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <rect x="2" y="3" width="7" height="5" rx="1.5" stroke={c} strokeWidth="1.6"/>
      <rect x="11" y="3" width="7" height="5" rx="1.5" stroke={c} strokeWidth="1.6"/>
      <path d="M5.5 8v2.5M14.5 8v2.5M5.5 10.5h9M10 10.5V14" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
      <rect x="6.5" y="14" width="7" height="4" rx="1.5" stroke={c} strokeWidth="1.6"/>
    </svg>
  )
}

export function EventLeadsIcon({ color: c }: IconProps) {
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

export function CampaignIcon({ color: c }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 7h14v9a1 1 0 01-1 1H4a1 1 0 01-1-1V7z" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 7l7-4 7 4" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 7l7 5 7-5" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function CsPipelineIcon({ color: c }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M4 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M10 8V4M10 4l-2 2M10 4l2 2" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="10" cy="15" r="1.5" fill={c}/>
      <path d="M6.5 17h7" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

export function PricingMigrationIcon({ color: c }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 14h14M3 10h14M3 6h14" stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="6" cy="6" r="1.5" fill={c}/>
      <circle cx="10" cy="10" r="1.5" fill={c}/>
      <circle cx="15" cy="14" r="1.5" fill={c}/>
    </svg>
  )
}

export function CommissionsIcon({ color: c }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="7" stroke={c} strokeWidth="1.6"/>
      <path d="M10 6v1.2M10 12.8V14M7.7 8.2c0-1 .9-1.7 2.3-1.7s2.3.7 2.3 1.7c0 2.3-4.6 1-4.6 3.3 0 1 .9 1.7 2.3 1.7s2.3-.7 2.3-1.7" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function SqlHandoffIcon({ color: c }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <rect x="2" y="4" width="4.5" height="12" rx="1.3" stroke={c} strokeWidth="1.6"/>
      <rect x="7.75" y="4" width="4.5" height="8" rx="1.3" stroke={c} strokeWidth="1.6"/>
      <rect x="13.5" y="4" width="4.5" height="5" rx="1.3" stroke={c} strokeWidth="1.6"/>
    </svg>
  )
}

export function PricingIcon({ color: c }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M10.6 2.5H16a1.5 1.5 0 011.5 1.5v5.4a1.5 1.5 0 01-.44 1.06l-6.6 6.6a1.5 1.5 0 01-2.12 0L3.94 12.66a1.5 1.5 0 010-2.12l6.6-6.6a1.5 1.5 0 011.06-.44z" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="13.5" cy="6.5" r="1.3" stroke={c} strokeWidth="1.6"/>
    </svg>
  )
}

export function BlueprintsIcon({ color: c }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2.5 5l5-2 5 2 5-2v12l-5 2-5-2-5 2V5z" stroke={c} strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M7.5 3v12M12.5 5v12" stroke={c} strokeWidth="1.6"/>
    </svg>
  )
}

export function AdminIcon({ color: c }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="7" stroke={c} strokeWidth="1.6"/>
      <circle cx="10" cy="10" r="2.5" stroke={c} strokeWidth="1.6"/>
      <path d="M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17M5.05 5.05l1.06 1.06M13.89 13.89l1.06 1.06M14.95 5.05l-1.06 1.06M6.11 13.89l-1.06 1.06" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

export const TOOL_ICONS: Record<IconKey, ComponentType<IconProps>> = {
  pipeline: PipelineIcon,
  sqlHandoff: SqlHandoffIcon,
  csPipeline: CsPipelineIcon,
  pricing: PricingIcon,
  pricingMigration: PricingMigrationIcon,
  commissions: CommissionsIcon,
  campaign: CampaignIcon,
  eventLeads: EventLeadsIcon,
  dedupe: DedupeIcon,
  blueprints: BlueprintsIcon,
}

export function LockIcon({ color: c }: IconProps) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke={c} strokeWidth="1.5"/>
      <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
