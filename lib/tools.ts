// Single registry of the hub's tools, grouped by job. Drives the sidebar (NavBar)
// and the home page. To add a tool: add an entry to TOOLS with its group, and an
// icon in components/layout/ToolIcons.tsx.

export type ToolGroupKey = 'marketing' | 'sales' | 'revops'

export type IconKey =
  | 'pipeline' | 'sqlHandoff' | 'csPipeline'
  | 'pricing' | 'pricingMigration' | 'commissions'
  | 'campaign' | 'eventLeads' | 'dedupe'
  | 'blueprints'

export interface ToolGroup {
  key: ToolGroupKey
  label: string
  description: string
}

export interface Tool {
  href: string
  title: string
  /** Short label used in the sidebar */
  navLabel: string
  description: string
  group: ToolGroupKey
  icon: IconKey
  color: string
  bg: string
  /** Env var holding a comma-separated email allowlist. Unset or empty means open to everyone. */
  allowEnv?: string
}

export const TOOL_GROUPS: ToolGroup[] = [
  { key: 'marketing', label: 'Marketing',       description: 'Launch campaigns and bring event leads into the CRM.' },
  { key: 'sales',     label: 'Sales',           description: 'Pipeline hygiene, SQL handoff and pricing for quotes.' },
  { key: 'revops',    label: 'RevOps',          description: 'GTM processes, CRM data, pricing migration and commissions.' },
]

export const TOOLS: Tool[] = [
  {
    href: '/campaign-setup',
    title: 'Campaign Setup',
    navLabel: 'Campaign Setup',
    description: 'AI-assisted campaign creation for HubSpot and Salesforce.',
    group: 'marketing',
    icon: 'campaign',
    color: 'var(--orange-700)',
    bg: 'var(--orange-50)',
    allowEnv: 'CAMPAIGN_SETUP_ALLOW',
  },
  {
    href: '/event-leads',
    title: 'Event Lead Pipeline',
    navLabel: 'Event Lead Pipeline',
    description: 'Clean and enrich event attendee lists before importing to CRM.',
    group: 'marketing',
    icon: 'eventLeads',
    color: 'var(--green-600)',
    bg: 'var(--green-50)',
    allowEnv: 'EVENT_LEADS_ALLOW',
  },
  {
    href: '/sql-handoff',
    title: 'SQL Handoff',
    navLabel: 'SQL Handoff',
    description: 'Disposition Qualifying opps, with SQL/SQO metrics and coverage.',
    group: 'sales',
    icon: 'sqlHandoff',
    color: 'var(--purple-500)',
    bg: 'var(--purple-50)',
  },
  {
    href: '/pipeline',
    title: 'Pipeline Hygiene (NB)',
    navLabel: 'Pipeline Hygiene (NB)',
    description: 'New business pipeline hygiene across the sales team.',
    group: 'sales',
    icon: 'pipeline',
    color: 'var(--blue-500)',
    bg: 'var(--blue-50)',
    allowEnv: 'PIPELINE_ALLOW',
  },
  {
    href: '/cs-pipeline',
    title: 'Pipeline Hygiene (EB)',
    navLabel: 'Pipeline Hygiene (EB)',
    description: 'Renewal and expansion pipeline for Customer Success.',
    group: 'sales',
    icon: 'csPipeline',
    color: 'var(--green-600)',
    bg: 'var(--green-50)',
    allowEnv: 'CS_PIPELINE_ALLOW',
  },
  {
    href: '/blueprints',
    title: 'GTM Blueprints',
    navLabel: 'GTM Blueprints',
    description: 'Maps of Orah\'s core go-to-market processes.',
    group: 'revops',
    icon: 'blueprints',
    color: 'var(--navy-900)',
    bg: 'var(--blue-50)',
  },
  {
    href: '/dedupe',
    title: 'CRM Dedupe',
    navLabel: 'CRM Dedupe',
    description: 'Find and merge duplicate companies across Salesforce and HubSpot.',
    group: 'revops',
    icon: 'dedupe',
    color: 'var(--purple-500)',
    bg: 'var(--purple-50)',
    allowEnv: 'DEDUPE_ALLOW',
  },
  {
    href: '/pricing',
    title: 'Pricing',
    navLabel: 'Pricing',
    description: 'What each plan includes, plus a calculator for quotes and proposals.',
    group: 'sales',
    icon: 'pricing',
    color: 'var(--navy-900)',
    bg: 'var(--blue-50)',
  },
  {
    href: '/pricing-migration',
    title: 'Pricing Migration',
    navLabel: 'Pricing Migration',
    description: 'Move open renewals onto the Supervise and Boarding pricing model.',
    group: 'revops',
    icon: 'pricingMigration',
    color: 'var(--blue-500)',
    bg: 'var(--blue-50)',
    allowEnv: 'PRICING_MIGRATION_ALLOW',
  },
  {
    href: '/commissions',
    title: 'Commissions',
    navLabel: 'Commissions',
    description: 'Rep commission on Closed Won deals against quarterly quota.',
    group: 'revops',
    icon: 'commissions',
    color: 'var(--orange-700)',
    bg: 'var(--orange-50)',
  },
]

/** True when the path belongs to this tool. Exact segment match, so /pricing doesn't catch /pricing-migration. */
export function matchesTool(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Server-only: reads the tool's allowlist env var. */
export function isToolLocked(tool: Tool, email: string): boolean {
  if (!tool.allowEnv) return false
  const allowed = (process.env[tool.allowEnv] ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return allowed.length > 0 && !allowed.includes(email.toLowerCase())
}

/** Server-only: hrefs of the tools this user can't open. */
export function lockedToolHrefs(email: string): string[] {
  return TOOLS.filter(t => isToolLocked(t, email)).map(t => t.href)
}
