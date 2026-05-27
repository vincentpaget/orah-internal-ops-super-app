import type { Opportunity, RepRow } from './types'
import { OPEN_STAGES } from './types'

export function getPeriodRange(period: string): { start: string; end: string; label: string } {
  const today = new Date()
  const y = today.getFullYear()
  const q = Math.floor(today.getMonth() / 3)
  const qStarts = ['01-01', '04-01', '07-01', '10-01']
  const qEnds   = ['03-31', '06-30', '09-30', '12-31']

  const thisStart = `${y}-${qStarts[q]}`
  const thisEnd   = `${y}-${qEnds[q]}`

  const nq = (q + 1) % 4
  const nqY = q === 3 ? y + 1 : y
  const nextStart = `${nqY}-${qStarts[nq]}`
  const nextEnd   = `${nqY}-${qEnds[nq]}`

  const lq = (q + 3) % 4
  const lqY = q === 0 ? y - 1 : y
  const lastStart = `${lqY}-${qStarts[lq]}`
  const lastEnd   = `${lqY}-${qEnds[lq]}`

  function addDays(d: Date, n: number): string {
    const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().split('T')[0]
  }
  const todayStr = today.toISOString().split('T')[0]

  switch (period) {
    case 'next_7_days':   return { start: `${y}-01-01`, end: addDays(today, 7),   label: 'Next 7 days' }
    case 'next_14_days':  return { start: `${y}-01-01`, end: addDays(today, 14),  label: 'Next 14 days' }
    case 'next_30_days':  return { start: `${y}-01-01`, end: addDays(today, 30),  label: 'Next 30 days' }
    case 'next_90_days':  return { start: `${y}-01-01`, end: addDays(today, 90),  label: 'Next 90 days' }
    case 'next_120_days': return { start: `${y}-01-01`, end: addDays(today, 120), label: 'Next 120 days' }
    case 'next_quarter': return { start: nextStart, end: nextEnd, label: 'Next Quarter' }
    case 'last_quarter': return { start: lastStart, end: lastEnd, label: 'Last Quarter' }
    case 'this_year':    return { start: `${y}-01-01`, end: `${y}-12-31`, label: 'This Year' }
    default:             return { start: thisStart, end: thisEnd, label: 'This Quarter' }
  }
}

export function computeRepRows(opps: Opportunity[]): RepRow[] {
  const repIds = [...new Set(
    opps.filter(o => OPEN_STAGES.includes(o.StageName)).map(o => o['Owner.Id'])
  )]
  return repIds.map(repId => {
    const openRepOpps = opps.filter(o =>
      o['Owner.Id'] === repId && OPEN_STAGES.includes(o.StageName)
    )
    const unhealthyCount = openRepOpps.filter(o =>
      o.flags.length > 0 || (o.StageName === 'Qualifying' && o.sqlBucket !== 'Demo Scheduled')
    ).length
    const healthPct = openRepOpps.length > 0
      ? Math.round(((openRepOpps.length - unhealthyCount) / openRepOpps.length) * 100)
      : 100
    return {
      repName: openRepOpps[0]['Owner.Name'],
      repId,
      pipelineARR: openRepOpps.reduce((s, o) => s + (o.Net_ARR_NZD__c ?? 0), 0),
      openOpps: openRepOpps.length,
      flaggedCount: unhealthyCount,
      healthPct,
    }
  }).sort((a, b) => b.healthPct - a.healthPct)
}
