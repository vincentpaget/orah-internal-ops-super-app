import { NextResponse } from 'next/server'
import { getRenewalFlags, getExpansionFlags, OPEN_RENEWAL_STAGES, OPEN_EXPANSION_STAGES } from '@/lib/csHygiene'
import { postCsHygiene } from '@/lib/slack'
import { getPeriodRange } from '@/lib/pipeline'
import { MOCK_RENEWALS, MOCK_EXPANSIONS } from '@/lib/mockData'
import type { SFRenewalOpp, SFExpansionOpp } from '@/lib/types'

const EXCLUDED_ACCOUNT = '0017F00000XJtiAQAT'

interface RepRow {
  repName: string
  ownerEmail: string | null
  openOpps: number
  flaggedOpps: number
  healthPct: number
}

function computeRepRows(renewals: SFRenewalOpp[], expansions: SFExpansionOpp[]): RepRow[] {
  const map = new Map<string, { openOpps: number; flaggedOpps: number; email: string | null }>()

  for (const opp of renewals) {
    if (!OPEN_RENEWAL_STAGES.has(opp.StageName)) continue
    const rep = opp['Owner.Name']
    if (!map.has(rep)) map.set(rep, { openOpps: 0, flaggedOpps: 0, email: opp['Owner.Email'] ?? null })
    const row = map.get(rep)!
    row.openOpps++
    if (getRenewalFlags(opp).length > 0) row.flaggedOpps++
  }

  for (const opp of expansions) {
    if (!OPEN_EXPANSION_STAGES.has(opp.StageName)) continue
    const rep = opp['Owner.Name']
    if (!map.has(rep)) map.set(rep, { openOpps: 0, flaggedOpps: 0, email: opp['Owner.Email'] ?? null })
    const row = map.get(rep)!
    row.openOpps++
    if (getExpansionFlags(opp).length > 0) row.flaggedOpps++
  }

  return [...map.entries()]
    .map(([repName, { openOpps, flaggedOpps, email }]) => ({
      repName,
      ownerEmail: email,
      openOpps,
      flaggedOpps,
      healthPct: openOpps > 0 ? Math.round(((openOpps - flaggedOpps) / openOpps) * 100) : 100,
    }))
    .sort((a, b) => b.healthPct - a.healthPct || b.openOpps - a.openOpps)
}

async function handler() {
  if (!process.env.SLACK_BOT_TOKEN) {
    return NextResponse.json(
      { error: 'Slack not configured — set SLACK_BOT_TOKEN' },
      { status: 503 }
    )
  }

  try {
    let renewals: SFRenewalOpp[] = MOCK_RENEWALS
    let expansions: SFExpansionOpp[] = MOCK_EXPANSIONS

    if (process.env.SF_USERNAME || process.env.SF_ACCESS_TOKEN) {
      const { fetchRenewals, fetchExpansions } = await import('@/lib/salesforce')
      const year = new Date().getFullYear().toString()
      ;[renewals, expansions] = await Promise.all([fetchRenewals(year), fetchExpansions(year)])
    }

    renewals   = renewals.filter(o => o.AccountId !== EXCLUDED_ACCOUNT)
    expansions = expansions.filter(o => o.AccountId !== EXCLUDED_ACCOUNT)

    const { start, end, label } = getPeriodRange('next_90_days')
    renewals   = renewals.filter(o => o.CloseDate >= start && o.CloseDate <= end)
    expansions = expansions.filter(o => o.CloseDate >= start && o.CloseDate <= end)

    const rows = computeRepRows(renewals, expansions)
    await postCsHygiene(rows, label)
    return NextResponse.json({ ok: true, reps: rows.length })
  } catch (err) {
    console.error('[send-cs-hygiene]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export const POST = handler
export const GET  = handler
