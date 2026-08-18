import type {
  SFSqlHandoffOpportunity,
  SFSqlDashboardRecord,
  EnrichedOpportunity,
  TabKey,
  WarningKey,
  WarningHit,
  MeddiccKey,
  ModalKind,
  ModalFormState,
  MeddiccGrade,
  ModalFieldSpec,
  GradeGuideEntry,
} from './types'
import { FUP_OPTIONS, LOSS_REASONS } from './types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const SALESFORCE_BASE = 'https://orah.lightning.force.com/lightning/r/Opportunity/'

function parseDateOnly(s: string): Date {
  return new Date(s + 'T00:00:00')
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function daysUntil(dateStr: string): number {
  return Math.round((parseDateOnly(dateStr).getTime() - startOfToday().getTime()) / 86_400_000)
}

function daysAgo(dateStr: string): number {
  return -daysUntil(dateStr)
}

function fmtShort(dateStr: string): string {
  const d = parseDateOnly(dateStr)
  return d.getDate() + ' ' + MONTHS[d.getMonth()]
}

function meetingLabel(dateStr: string | null): string {
  if (!dateStr) return '—'
  const days = daysUntil(dateStr)
  const base = fmtShort(dateStr)
  if (days === 0) return base + ' · today'
  if (days > 0) return base + ' · in ' + days + 'd'
  return base + ' · ' + -days + 'd ago'
}

// ── Outcome pills ────────────────────────────────────────────────────────────

export const OUTCOMES: Record<string, { label: string; bg: string; fg: string }> = {
  '': { label: 'Not Set', bg: '#F5F5F5', fg: '#434343' },
  'No-show': { label: 'No-show', bg: '#FFF3E0', fg: '#B35C00' },
  'Held - interested': { label: 'Interested', bg: '#E8F5E9', fg: '#2E7D32' },
  'Held - not interested': { label: 'Not Interested', bg: '#FDECEC', fg: '#D32F2F' },
  'Held - deferred': { label: 'Deferred', bg: '#FFF8E1', fg: '#8A6100' },
  'Held - disqualified': { label: 'Disqualified', bg: '#FDECEC', fg: '#D32F2F' },
  'Held - other': { label: 'Other', bg: '#E3F2FE', fg: '#003F7F' },
  'No call detected': { label: 'No Call Detected', bg: '#EDE7F4', fg: '#8255B1' },
}

export function outcomePill(outcome: string | null): { label: string; bg: string; fg: string } {
  return OUTCOMES[outcome ?? ''] ?? OUTCOMES['']
}

export const OUTCOME_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '-- None --' },
  { value: 'No-show', label: 'No-show' },
  { value: 'Held - interested', label: 'Held - interested' },
  { value: 'Held - not interested', label: 'Held - not interested' },
  { value: 'Held - deferred', label: 'Held - deferred' },
  { value: 'Held - disqualified', label: 'Held - disqualified' },
  { value: 'Held - other', label: 'Held - other' },
  { value: 'No call detected', label: 'No call detected' },
]

const UNDISPOSITIONED = new Set([null, '', 'No call detected'])
const HELD = new Set(['Held - interested', 'Held - not interested', 'Held - deferred', 'Held - disqualified', 'Held - other'])

// ── Tabs ─────────────────────────────────────────────────────────────────────

export const TABS: { key: TabKey; label: string; hint: string; criteria: string }[] = [
  {
    key: 'all', label: 'All', hint: 'Every open opportunity in the Qualifying stage.',
    criteria: 'No filter — every open Qualifying opportunity.',
  },
  {
    key: 'no-meeting', label: 'No Meeting Set', hint: 'No meeting booked yet and the initial meeting has not been held. Get one on the calendar.',
    criteria: 'Not a Held outcome, AND not Outcome Required (see below), AND no Next Meeting is set.',
  },
  {
    key: 'scheduled', label: 'Meeting Scheduled', hint: 'A meeting is booked but the initial meeting has not been held. Prepare and make sure they show up!',
    criteria: 'Not a Held outcome, AND not Outcome Required (see below), AND a Next Meeting is set.',
  },
  {
    key: 'outcome-required', label: 'Outcome Required', hint: 'A meeting has happened but no outcome has been set. Disposition these first.',
    criteria: 'Meeting Outcome is blank or "No call detected", AND a Last Meeting is set.',
  },
  {
    key: 'held', label: 'Held · Action Required', hint: 'Demo held and dispositioned. Move each into Evaluation, Nurturing, or Closed - Disqualified.',
    criteria: 'Meeting Outcome is "Held - interested", "Held - not interested", "Held - deferred", "Held - disqualified", or "Held - other".',
  },
]

// Default sort applied whenever the user switches to a tab — "newest to oldest" means smallest
// age (most recently created) first for the age field, and latest calendar date first for date fields.
export const TAB_DEFAULT_SORT: Record<TabKey, { key: string; dir: 1 | -1 }> = {
  all: { key: 'age', dir: 1 },
  'no-meeting': { key: 'age', dir: 1 },
  scheduled: { key: 'Next_Meeting_Date__c', dir: 1 },
  'outcome-required': { key: 'Last_Meeting_Date__c', dir: -1 },
  held: { key: 'Last_Meeting_Date__c', dir: -1 },
}

export function matchTab(c: EnrichedOpportunity, key: TabKey): boolean {
  const outcome = c.Initial_Meeting_Outcome__c
  const isHeld = HELD.has(outcome ?? '')
  const isOutcomeRequired = UNDISPOSITIONED.has(outcome) && !!c.Last_Meeting_Date__c
  const isNotYetHeld = !isHeld && !isOutcomeRequired
  const hasNext = !!c.Next_Meeting_Date__c
  switch (key) {
    case 'all':
      return true
    case 'no-meeting':
      return isNotYetHeld && !hasNext
    case 'scheduled':
      return isNotYetHeld && hasNext
    case 'outcome-required':
      return isOutcomeRequired
    case 'held':
      return isHeld
    default:
      return false
  }
}

// ── Warnings ─────────────────────────────────────────────────────────────────

export const WARNINGS: { key: WarningKey; label: string; test: (c: EnrichedOpportunity) => boolean; detail: (c: EnrichedOpportunity) => string }[] = [
  { key: 'step', label: 'No next steps', test: c => !c.NextStep, detail: () => 'Next Step field is empty' },
  {
    key: 'act', label: 'No activity for 14 days',
    test: c => c.touchedDays == null || c.touchedDays > 14,
    detail: c => (c.touchedDays == null ? 'Never touched' : `Last touched ${c.touchedDays}d ago`),
  },
  { key: 'meet', label: 'No next meeting', test: c => !c.Next_Meeting_Date__c, detail: () => 'No future meeting scheduled' },
  { key: 'age', label: 'Aging over 30 days', test: c => c.age > 30, detail: c => `${c.age} days since created` },
]

// ── MEDDICC ──────────────────────────────────────────────────────────────────

export const MEDDICC_FIELDS: {
  key: MeddiccKey
  label: string
  gradeField: keyof SFSqlHandoffOpportunity
  reasonField: keyof SFSqlHandoffOpportunity
  notesField: keyof SFSqlHandoffOpportunity
}[] = [
  { key: 'me', label: 'Metrics', gradeField: 'Metrics__c', reasonField: 'Metrics_Grade_Reason__c', notesField: 'Metric_Notes__c' },
  { key: 'eb', label: 'Economic Buyer', gradeField: 'Economic_Buyer__c', reasonField: 'Economic_Buyer_Grade_Notes__c', notesField: 'Economic_Buyer_Notes__c' },
  { key: 'dc', label: 'Decision Criteria', gradeField: 'Decision_Criteria__c', reasonField: 'Decision_Criteria_Grade_Reason__c', notesField: 'Decision_Criteria_Notes__c' },
  { key: 'dp', label: 'Decision Process', gradeField: 'Decision_Process__c', reasonField: 'Decision_Process_Grade_Reason__c', notesField: 'Decision_Process_Notes__c' },
  { key: 'ip', label: 'Identified Pain', gradeField: 'Identified_Pain__c', reasonField: 'Identified_Pain_Grade_Reason__c', notesField: 'Identified_Pain_Notes__c' },
  { key: 'ch', label: 'Champion', gradeField: 'Champion__c', reasonField: 'Champion_Grade_Reason__c', notesField: 'Champion_Notes__c' },
  { key: 'ce', label: 'Compelling Event', gradeField: 'Compelling_Event__c', reasonField: 'Compelling_Event_Grade_Notes__c', notesField: 'Compelling_Event_Notes__c' },
  { key: 'co', label: 'Competition', gradeField: 'Competition__c', reasonField: 'Competition_Grade_Reason__c', notesField: 'Competition_Notes__c' },
]

export const GRADE_GUIDE: Record<MeddiccKey, GradeGuideEntry[]> = {
  me: [
    { grade: 'Green', text: 'Specific quantified impact validated by the prospect — "saves 2 hours per housemaster per week", "replaces a $15k/year manual process", "40% fewer late-night welfare checks".' },
    { grade: 'Yellow', text: 'Value acknowledged but not quantified, or the rep estimated the impact without the prospect validating the numbers.' },
    { grade: 'Red', text: 'No value articulated beyond product features, or the prospect has not engaged on value at all.' },
  ],
  eb: [
    { grade: 'Green', text: 'Named person with confirmed budget authority, already engaged (or confirmed they will be).' },
    { grade: 'Yellow', text: 'Named person, but budget authority unconfirmed or not yet engaged.' },
    { grade: 'Red', text: 'No named person, or contact has no purchasing power (IT admin, teacher, office staff).' },
  ],
  dc: [
    { grade: 'Green', text: 'The prospect has explicitly stated what they need to see to decide, how they will evaluate options, and what success looks like.' },
    { grade: 'Yellow', text: 'Some criteria known but incomplete, or inferred from conversation rather than stated by the prospect.' },
    { grade: 'Red', text: 'No evaluation criteria established, or the prospect has not engaged on how they will decide.' },
  ],
  dp: [
    { grade: 'Green', text: 'Decision process confirmed by the prospect — who is involved, what steps happen, and by when. All stakeholders and approvals mapped.' },
    { grade: 'Yellow', text: 'Some steps or stakeholders identified but the full process or timeline is unclear — gaps remain.' },
    { grade: 'Red', text: 'No decision process established — who else is involved, what steps are required, and when a decision lands are all unknown.' },
  ],
  ip: [
    { grade: 'Green', text: 'Specific operational pain in the prospect’s own words with a clear consequence of not solving it — "no way to track whereabouts after lights out", "parents call us and we have no real-time visibility".' },
    { grade: 'Yellow', text: 'Pain acknowledged but surface level, or identified by the rep rather than surfaced and confirmed by the prospect.' },
    { grade: 'Red', text: 'No pain identified, or the stated pain is generic and not tied to a real operational problem at the school.' },
  ],
  ch: [
    { grade: 'Green', text: 'Named individual actively advocating for Orah internally, with confirmed influence and access to the economic buyer.' },
    { grade: 'Yellow', text: 'Named individual engaged and enthusiastic, but internal influence or access to the economic buyer is unconfirmed.' },
    { grade: 'Red', text: 'No champion, or the engaged contact is enthusiastic but has no influence and no access to decision makers.' },
  ],
  ce: [
    { grade: 'Green', text: 'Specific dated event confirmed by the prospect — new boarding house in Sept, contract ends July, compliance deadline, board mandate before the school year.' },
    { grade: 'Yellow', text: 'Urgency expressed but no date or event pinned down — "we want this sorted soon".' },
    { grade: 'Red', text: 'No urgency, no timeline, or a generic reason ("improve things eventually").' },
  ],
  co: [
    { grade: 'Green', text: 'Orah is the only solution being evaluated, or the prospect has expressed a clear preference for Orah over the alternatives mentioned. Default to Green when no competitor came up.' },
    { grade: 'Yellow', text: 'One or more alternatives being evaluated alongside Orah, or a competitor mentioned with no preference expressed.' },
    { grade: 'Red', text: 'A competitor is preferred, the prospect is defending the status quo, or Orah is only a benchmarking option.' },
  ],
}

export function buildMeddiccFields(form: Partial<Record<MeddiccKey, { grade: string; notes: string }>>): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  MEDDICC_FIELDS.forEach(m => {
    const entry = form[m.key]
    if (!entry) return
    fields[m.gradeField] = entry.grade
    fields[m.notesField] = entry.notes || null
  })
  return fields
}

export function gradeColors(g: string | null): { bg: string; fg: string } {
  if (g === 'Green') return { bg: '#E8F5E9', fg: '#2E7D32' }
  if (g === 'Yellow') return { bg: '#FFF3E0', fg: '#B35C00' }
  return { bg: '#FDECEC', fg: '#D32F2F' }
}

export function buildModalForm(target: SFSqlHandoffOpportunity): ModalFormState {
  const meddicc = {} as ModalFormState['meddicc']
  MEDDICC_FIELDS.forEach(m => {
    meddicc[m.key] = {
      grade: (target[m.gradeField] as MeddiccGrade | null) || 'Red',
      notes: (target[m.notesField] as string | null) || '',
    }
  })
  return {
    closeDate: target.CloseDate || '',
    amount: target.Amount == null ? '' : String(target.Amount),
    nextStep: target.NextStep || '',
    outcome: target.Initial_Meeting_Outcome__c || '',
    fup: target.Initial_Meeting_FUp_Email_Status__c || FUP_OPTIONS[0],
    reengage: '',
    nurtureReason: '',
    lossReasonLabel: LOSS_REASONS[0].label,
    lossDetail: '',
    managerReviewNotes: target.Manager_Review_Notes__c || '',
    discoveryNotes: target.Discovery_Notes__c || '',
    meddicc,
  }
}

export function stageForKind(kind: ModalKind): string {
  if (kind === 'qualify') return 'Evaluation'
  if (kind === 'nurture') return 'Nurturing'
  if (kind === 'dq') return 'Closed - Disqualified'
  return 'Qualifying'
}

// Which MEDDICC rows are shown/editable per modal kind — Edit exposes the full grid (optional,
// for ongoing review), Qualify/Nurture only gate on Economic Buyer and Compelling Event.
export function meddiccKeysForKind(kind: ModalKind): MeddiccKey[] {
  if (kind === 'edit') return MEDDICC_FIELDS.map(m => m.key)
  if (kind === 'qualify' || kind === 'nurture') return ['eb', 'ce']
  return []
}

export function isPastDate(dateStr: string): boolean {
  if (!dateStr) return false
  return dateStr < new Date().toISOString().slice(0, 10)
}

export function closeDateError(form: ModalFormState, checkReengage: boolean): string | null {
  if (!form.closeDate) return 'Required.'
  if (isPastDate(form.closeDate)) return 'Close date cannot be in the past.'
  if (checkReengage && form.reengage && form.closeDate < form.reengage) return 'Close date cannot be before the re-engagement date.'
  return null
}

export function isModalBlocked(kind: ModalKind, form: ModalFormState): boolean {
  // Quick Edit is a free-form save — it never blocks on validation.
  if (kind === 'edit') return false
  const ebOk = form.meddicc.eb.grade !== 'Red'
  const ceOk = form.meddicc.ce.grade !== 'Red'
  const amountOk = form.amount.trim() !== '' && Number(form.amount) > 0
  if (kind === 'qualify') {
    return !!closeDateError(form, false) || !amountOk || !ebOk || !ceOk
  }
  if (kind === 'nurture') {
    return !!closeDateError(form, true) || !amountOk || !form.reengage || !form.nurtureReason || !ebOk || !ceOk
  }
  if (kind === 'dq') {
    return !form.lossReasonLabel || !form.lossDetail || !form.nextStep
  }
  return false
}

export interface ModalRequirement {
  text: string
  ok: boolean
}

export function buildModalRequirements(kind: ModalKind, form: ModalFormState): { title: string; items: ModalRequirement[] } {
  const ebOk = form.meddicc.eb.grade !== 'Red'
  const ceOk = form.meddicc.ce.grade !== 'Red'
  const amountOk = form.amount.trim() !== '' && Number(form.amount) > 0
  if (kind === 'qualify') {
    return {
      title: 'Required To Move To Evaluation',
      items: [
        { text: 'Close date set and not in the past', ok: !!form.closeDate && !isPastDate(form.closeDate) },
        { text: 'Amount must be set', ok: amountOk },
        { text: 'Economic Buyer Grade at least Yellow', ok: ebOk },
        { text: 'Compelling Event Grade at least Yellow', ok: ceOk },
      ],
    }
  }
  if (kind === 'nurture') {
    return {
      title: 'Required To Move To Nurture',
      items: [
        { text: 'Re-engagement date set — agreed with the prospect', ok: !!form.reengage },
        { text: 'Close date not in the past and not before the re-engagement date', ok: !!form.closeDate && !isPastDate(form.closeDate) && !(!!form.reengage && form.closeDate < form.reengage) },
        { text: 'Nurturing reason set', ok: !!form.nurtureReason },
        { text: 'Amount must be set', ok: amountOk },
        { text: 'Economic Buyer Grade at least Yellow', ok: ebOk },
        { text: 'Compelling Event Grade at least Yellow', ok: ceOk },
      ],
    }
  }
  if (kind === 'dq') {
    return {
      title: 'Required To Disqualify',
      items: [
        { text: 'Loss reason selected', ok: !!form.lossReasonLabel },
        { text: 'Loss reason detail written', ok: !!form.lossDetail },
        { text: 'Next steps recorded', ok: !!form.nextStep },
      ],
    }
  }
  return { title: '', items: [] }
}

export function buildModalFields(kind: ModalKind, target: EnrichedOpportunity, form: ModalFormState): ModalFieldSpec[] {
  const amountOk = form.amount.trim() !== '' && Number(form.amount) > 0
  const stage = stageForKind(kind)

  if (kind === 'edit') {
    return [
      { key: 'stage', label: 'Stage', kind: 'ro', value: 'Qualifying', span: 1 },
      { key: 'amount', label: 'Amount (Net ARR)', kind: 'number', value: form.amount, placeholder: 'e.g. 12000', span: 1 },
      { key: 'closeDate', label: 'Close Date', kind: 'date', value: form.closeDate, span: 1 },
      { key: 'outcome', label: 'Initial Meeting Outcome', kind: 'select', value: form.outcome, options: OUTCOME_SELECT_OPTIONS.map(o => o.value), span: 1 },
      { key: 'fup', label: 'Initial Meeting FUp Status', kind: 'select', value: form.fup, options: [...FUP_OPTIONS], span: 1 },
      { key: 'nextStep', label: 'Next Steps', kind: 'area', value: form.nextStep, placeholder: 'What happens next', span: 1 },
      { key: 'lastMeeting', label: 'Last Meeting Date', kind: 'ro', value: target.lastMeetingLabel, span: 1 },
      { key: 'nextMeeting', label: 'Next Meeting Date', kind: 'ro', value: target.nextLabel, span: 1 },
      { key: 'discoveryNotes', label: 'Discovery Notes', kind: 'area', value: form.discoveryNotes, placeholder: 'What the prospect told us', span: 1 },
    ]
  }
  if (kind === 'qualify') {
    return [
      { key: 'stage', label: 'Stage', kind: 'ro', value: stage, span: 1 },
      { key: 'amount', label: 'Amount (Net ARR)', kind: 'number', value: form.amount, error: amountOk ? null : 'Amount must be set.', required: true, placeholder: 'e.g. 12000', span: 1 },
      { key: 'closeDate', label: 'Close Date', kind: 'date', value: form.closeDate, error: closeDateError(form, false), required: true, span: 1 },
      { key: 'nextMeeting', label: 'Next Meeting Date', kind: 'ro', value: target.nextLabel, span: 1 },
      { key: 'nextStep', label: 'Next Steps', kind: 'area', value: form.nextStep, placeholder: 'What happens next', span: 2 },
    ]
  }
  if (kind === 'nurture') {
    return [
      { key: 'stage', label: 'Stage', kind: 'ro', value: stage, span: 1 },
      { key: 'amount', label: 'Amount (Net ARR)', kind: 'number', value: form.amount, error: amountOk ? null : 'Amount must be set.', required: true, placeholder: 'e.g. 12000', span: 1 },
      { key: 'closeDate', label: 'Close Date', kind: 'date', value: form.closeDate, error: closeDateError(form, true), required: true, span: 1 },
      { key: 'nextMeeting', label: 'Next Meeting Date', kind: 'ro', value: target.nextLabel, span: 1 },
      { key: 'reengage', label: 'Re-engagement Date', kind: 'date', value: form.reengage, error: form.reengage ? null : 'Required — the date agreed with the prospect.', required: true, span: 1 },
      { key: 'nurtureReason', label: 'Nurturing Reason', kind: 'area', value: form.nurtureReason, error: form.nurtureReason ? null : 'Required — the prospect’s reason for deferring.', required: true, placeholder: 'Reason given by the prospect to defer evaluation', span: 1.5 },
      { key: 'nextStep', label: 'Next Steps', kind: 'area', value: form.nextStep, placeholder: 'What happens next', span: 1.5 },
    ]
  }
  if (kind === 'dq') {
    return [
      { key: 'stage', label: 'Stage', kind: 'ro', value: stage, span: 1 },
      { key: 'lossReasonLabel', label: 'Loss Reason', kind: 'select', value: form.lossReasonLabel, options: LOSS_REASONS.map(r => r.label), error: form.lossReasonLabel ? null : 'Required.', required: true, span: 2 },
      { key: 'lossDetail', label: 'Loss Reason Detail', kind: 'area', value: form.lossDetail, error: form.lossDetail ? null : 'Required.', required: true, placeholder: 'Why the deal was disqualified', span: 1.5 },
      { key: 'nextStep', label: 'Next Steps', kind: 'area', value: form.nextStep, error: form.nextStep ? null : 'Required.', required: true, placeholder: 'What happens with this account now', span: 1.5 },
    ]
  }
  return []
}

// ── Enrichment ───────────────────────────────────────────────────────────────

export function enrichOpportunity(opp: SFSqlHandoffOpportunity): EnrichedOpportunity {
  const age = daysAgo(opp.SQL_Date__c)
  const nextLabel = meetingLabel(opp.Next_Meeting_Date__c)
  const lastMeetingLabel = opp.Last_Meeting_Date__c
    ? fmtShort(opp.Last_Meeting_Date__c) + ' · ' + daysAgo(opp.Last_Meeting_Date__c) + 'd ago'
    : '—'

  const todayStr = new Date().toISOString().slice(0, 10)
  const touchedCandidates = [opp.Last_Meeting_Date__c, opp.LastActivityDate]
    .filter((d): d is string => !!d && d <= todayStr)
    .sort()
  const touched = touchedCandidates.length ? touchedCandidates[touchedCandidates.length - 1] : null
  const touchedDays = touched ? daysAgo(touched) : null
  const touchedLabel = touched ? fmtShort(touched) + ' · ' + touchedDays + 'd ago' : 'Never'

  const partial = { ...opp, age, nextLabel, lastMeetingLabel, touched, touchedDays, touchedLabel } as EnrichedOpportunity

  const hits = WARNINGS.filter(w => w.test(partial))
  const warnKeys: WarningKey[] = hits.map(w => w.key)
  const warnList: WarningHit[] = hits.map(w => ({ key: w.key, label: w.label, detail: w.detail(partial) }))

  return {
    ...partial,
    warnKeys,
    warnList,
    warnCount: hits.length,
    sfUrl: SALESFORCE_BASE + opp.Id + '/view',
  }
}

// ── Matrices ─────────────────────────────────────────────────────────────────

const MATRIX_TAB_KEYS: TabKey[] = ['no-meeting', 'scheduled', 'outcome-required', 'held']
export const MATRIX_TAB_HEADS: { key: TabKey; label: string; tip: string }[] = [
  { key: 'no-meeting', label: 'No Meeting Set', tip: 'No Meeting Set' },
  { key: 'scheduled', label: 'Meeting Scheduled', tip: 'Meeting Scheduled' },
  { key: 'outcome-required', label: 'Outcome Required', tip: 'Outcome Required' },
  { key: 'held', label: 'Held · Action Required', tip: 'Held · Action Required' },
]

export interface MatrixRow {
  name: string
  total: number
  cells: number[]
}

export function buildMatrix(scoped: EnrichedOpportunity[], field: 'Owner.Name' | 'CreatedBy.Name'): MatrixRow[] {
  const names: string[] = []
  scoped.forEach(c => {
    if (!names.includes(c[field])) names.push(c[field])
  })
  return names
    .map(name => {
      const rows = scoped.filter(c => c[field] === name)
      return {
        name,
        total: rows.length,
        cells: MATRIX_TAB_KEYS.map(k => rows.filter(c => matchTab(c, k)).length),
      }
    })
    .sort((a, b) => b.total - a.total)
}

export function computeStageCounts(scoped: EnrichedOpportunity[]): { key: TabKey; label: string; count: number }[] {
  return TABS.filter(t => t.key !== 'all').map(t => ({
    key: t.key,
    label: t.label.replace(' · ', ' '),
    count: scoped.filter(c => matchTab(c, t.key)).length,
  }))
}

export function computeWarningsSummary(scoped: EnrichedOpportunity[]): { key: WarningKey; label: string; count: number }[] {
  return WARNINGS.map(w => ({ key: w.key, label: w.label, count: scoped.filter(c => w.test(c)).length }))
}

// ── Dashboard period metrics ─────────────────────────────────────────────────

export interface PeriodStats {
  newSql: number
  cohort: number
  conv: number
  arr: string
  speed: string
  avg: string
  pct: string
}

export interface DashboardMetrics {
  l7: PeriodStats
  l30: PeriodStats
  mtd: PeriodStats
  qtd: PeriodStats
}

function money(n: number): string {
  return n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : '$' + Math.round(n)
}

function median(ns: number[]): number {
  const s = ns.slice().sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}

export function quarterStart(today: Date = new Date()): Date {
  const qMonth = Math.floor(today.getMonth() / 3) * 3
  return new Date(today.getFullYear(), qMonth, 1)
}

export function computeDashboardMetrics(history: SFSqlDashboardRecord[], ownerFilter: string[]): DashboardMetrics {
  const today = new Date()
  const cutoffs = {
    l7: isoDate(addDays(today, -7)),
    l30: isoDate(addDays(today, -30)),
    mtd: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    qtd: isoDate(quarterStart(today)),
  }
  const mine = (r: SFSqlDashboardRecord) => ownerFilter.length === 0 || ownerFilter.includes(r['Owner.Name'])

  function period(cutoff: string): PeriodStats {
    const newSqlRecs = history.filter(r => mine(r) && r.SQL_Date__c != null && r.SQL_Date__c >= cutoff)
    const cohortRecs = newSqlRecs.filter(r => r.SQO_Date__c != null)
    const sqoRecs = history.filter(r => mine(r) && r.SQO_Date__c != null && r.SQO_Date__c >= cutoff)
    const days = sqoRecs.map(r => r.SQL_to_SQO_Days__c).filter((d): d is number => d != null)
    const sum = sqoRecs.reduce((s, r) => s + (r.Net_ARR_NZD__c ?? 0), 0)
    return {
      newSql: newSqlRecs.length,
      cohort: cohortRecs.length,
      conv: sqoRecs.length,
      arr: sqoRecs.length ? money(sum) : '—',
      speed: days.length ? median(days) + 'd' : '—',
      avg: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) + 'd' : '—',
      pct: newSqlRecs.length ? Math.round((cohortRecs.length / newSqlRecs.length) * 100) + '%' : '—',
    }
  }

  return { l7: period(cutoffs.l7), l30: period(cutoffs.l30), mtd: period(cutoffs.mtd), qtd: period(cutoffs.qtd) }
}
