'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ProposalOpp } from '@/app/api/pricing/opportunities/route'
import { MIN_STUDENTS, type Quote, type QuoteInput } from '@/lib/pricing/calc'
import { ONE_TIME_FEES, type CurrencyCode } from '@/lib/pricing/data'
import { DISCOUNT_POLICY, DISCOUNT_POLICY_URL, OFFER_LABELS, type OfferType } from '@/lib/proposal/config'
import { generateBrief, EXPIRY_MAX_DAYS, type BriefInput } from '@/lib/proposal/brief'
import { lineAnnual, type ComputedOffer, type LineItem } from '@/lib/proposal/calc'
import { addDays, formatLong, formatShort } from '@/lib/proposal/dates'
import { money, months, unitMoney } from '@/lib/proposal/format'
import { quoteToLines, quoteToOneTimeFees } from '@/lib/proposal/quoteToLines'
import type { OfferDraft } from './draft'
import OpportunityPicker from './OpportunityPicker'
import { CurrencySelect } from '../Controls'
import { Field, GRID, INPUT, Notice, TextInput } from './ui'
import styles from '../pricing.module.css'

const PANEL: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  boxShadow: 'var(--shadow-1)',
  padding: 28,
  marginBottom: 20,
}

const HEADER_BTN: React.CSSProperties = { padding: '9px 16px', borderRadius: 6, border: '2px solid var(--navy-900)', background: 'var(--bg)', color: 'var(--navy-900)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }

function QtyInput({ value, min, label, onChange }: { value: string; min: number; label: string; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      className={styles.qtyInput}
      min={min}
      value={value}
      aria-label={label}
      onChange={e => onChange(e.target.value)}
      style={{ ...INPUT, width: 90, padding: '4px 8px', fontSize: 13, textAlign: 'right' }}
    />
  )
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function Section({ n, title, aside, children }: { n: number; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={PANEL}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--navy-900)', margin: 0 }}>
          {n}. {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function parsePct(s: string): number {
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export interface QtyEdits {
  /** Raw student count input, so typing isn't clamped mid-keystroke */
  studentInput: string
  onStudents: (value: string) => void
  onAddonQty: (addonId: string, qty: number) => void
  onOneTimeQty: (feeId: string, qty: number) => void
  onCurrency: (currency: CurrencyCode) => void
}

export default function OfferBuilder({ quote, quoteInput, draft, onDraftChange, edits, notices, onDismissNotices, onBack }: {
  quote: Quote
  quoteInput: QuoteInput
  draft: OfferDraft
  onDraftChange: (patch: Partial<OfferDraft>) => void
  edits: QtyEdits
  /** Warnings from loading an existing proposal */
  notices: string[]
  onDismissNotices: () => void
  onBack: () => void
}) {
  const currency = quoteInput.currency
  const lines = useMemo(() => quoteToLines(quote, quoteInput), [quote, quoteInput])
  const oneTimeFees = useMemo(() => quoteToOneTimeFees(quote), [quote])

  const {
    opp, schoolName, contactName, contactTitle, sis, repName, repEmail,
    proposalDate, expiryDate, syMonth, termYears, startDate,
    include, recommended, discount, oneTimeDiscount,
    kickoff, setupWindow, trainingWindow, notes, signBy, goLive,
  } = draft
  const set = <K extends keyof OfferDraft>(key: K) => (value: OfferDraft[K]) => onDraftChange({ [key]: value } as Partial<OfferDraft>)

  // Section 1 rows → calculator ids, for the quantity inputs. Flat add-ons and onboarding aren't editable here.
  const addonIdFor = (i: number) => {
    const line = quote.addonLines[i]
    return line?.perStudent ? quote.tier.addons.find(a => a.name === line.name)?.id : undefined
  }
  const feeIdFor = (i: number) => {
    const line = quote.oneTimeLines[i]
    return line && ONE_TIME_FEES.find(f => f.name === line.name)?.id
  }

  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  function selectOpp(o: ProposalOpp) {
    onDraftChange({
      opp: o,
      schoolName: o.accountName,
      contactName: o.contact?.name ?? '',
      contactTitle: o.contact?.title ?? '',
      sis: o.sis ?? '',
      repName: o.ownerName,
      repEmail: o.ownerEmail,
    })
  }

  const schoolYearStart = `${pad2(syMonth)}-01`

  const baseInput: BriefInput = {
    currency,
    lines,
    oneTimeFees,
    oneTimeDiscountPct: { standard: parsePct(oneTimeDiscount.standard), funded: parsePct(oneTimeDiscount.funded) },
    schoolYearStart,
    termYears,
    startDate,
    include,
    discountPct: { standard: parsePct(discount.standard), funded: parsePct(discount.funded) },
    schoolName,
    contactName,
    contactTitle,
    repName,
    repEmail,
    opportunityId: opp?.id ?? '',
    opportunityName: opp?.name ?? '',
    proposalDate,
    expiryDate,
    sis,
    recommended,
    rollout: { signByDate: signBy ?? expiryDate, kickoffDate: formatShort(kickoff), setupWindow, trainingWindow, notes, goLiveDate: '' },
  }
  // Two passes: the first gives the default go-live, the second renders with it.
  const defaultGoLive = startDate ? generateBrief(baseInput).result.defaultGoLive : ''
  const input: BriefInput = { ...baseInput, rollout: { ...baseInput.rollout, goLiveDate: goLive ?? defaultGoLive } }
  const { result, policy, missing, canGenerate, text } = generateBrief(input)

  const bothSelected = result.options.length === 2
  const fundedDisabled = !!startDate && !result.fundedAllowed
  const m = (n: number) => money(n, currency)

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
  }

  // claude.ai pre-fills the message box from ?q= (not sent until the rep presses Enter).
  // The brief is also copied, as a fallback if the pre-fill doesn't come through.
  const claudeUrl = `https://claude.ai/new?q=${encodeURIComponent(text)}`
  function sendToClaude() {
    navigator.clipboard.writeText(text).then(() => setCopied(true), () => {})
  }

  function download() {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const slug = (schoolName || 'proposal').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
    a.download = `proposal-brief-${slug}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const policyLink = (
    <a href={DISCOUNT_POLICY_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--blue-500)' }}>
      Read the Discount &amp; Terms Policy ↗
    </a>
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--navy-900)', margin: 0 }}>Generate Proposal Offer</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--fg-3)', fontSize: 14 }}>Build the PROPOSAL BRIEF to paste into Claude.</p>
        </div>
        <button type="button" className={styles.secondaryBtn} onClick={onBack} style={HEADER_BTN}>
          ← Back to calculator
        </button>
      </div>

      {notices.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Notice tone="info">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <strong>Loaded from an existing proposal.</strong> Proposal and expiry dates are reset to today. Check these:
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {notices.map(n => <li key={n}>{n}</li>)}
                </ul>
              </div>
              <button type="button" onClick={onDismissNotices} aria-label="Dismiss" style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
          </Notice>
        </div>
      )}

      <Section
        n={1}
        title="Pricing from calculator"
        aside={
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--fg-2)' }}>
            Currency
            <CurrencySelect value={currency} onChange={edits.onCurrency} />
          </label>
        }
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--fg-3)', textAlign: 'left' }}>
              <th style={{ padding: '6px 0', fontWeight: 600 }}>Product</th>
              <th style={{ padding: '6px 0', fontWeight: 600, textAlign: 'right' }}>Qty</th>
              <th style={{ padding: '6px 0', fontWeight: 600, textAlign: 'right' }}>Unit list</th>
              <th style={{ padding: '6px 0', fontWeight: 600, textAlign: 'right' }}>Annual list</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.product} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '7px 0' }}>{l.product}</td>
                <td style={{ padding: '7px 0', textAlign: 'right' }}>
                  {i === 0 ? (
                    <QtyInput value={edits.studentInput} min={MIN_STUDENTS} label={`${l.product} students`} onChange={edits.onStudents} />
                  ) : addonIdFor(i - 1) ? (
                    <QtyInput value={String(l.qty)} min={1} label={`${l.product} quantity`} onChange={v => edits.onAddonQty(addonIdFor(i - 1)!, parseInt(v) || 0)} />
                  ) : l.qty}
                </td>
                <td style={{ padding: '7px 0', textAlign: 'right' }}>{unitMoney(l.unitPrice, currency)}</td>
                <td style={{ padding: '7px 0', textAlign: 'right' }}>{m(lineAnnual(l))}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid var(--border-strong)', fontWeight: 700 }}>
              <td style={{ padding: '7px 0' }} colSpan={3}>List total</td>
              <td style={{ padding: '7px 0', textAlign: 'right' }}>{m(result.listTotal)}</td>
            </tr>
            {oneTimeFees.map((l, i) => (
              <tr key={l.product}>
                <td style={{ padding: '7px 0' }}>{l.product} (one-time)</td>
                <td style={{ padding: '7px 0', textAlign: 'right' }}>
                  {feeIdFor(i - 1) ? (
                    <QtyInput value={String(l.qty)} min={1} label={`${l.product} quantity`} onChange={v => edits.onOneTimeQty(feeIdFor(i - 1)!, Math.max(1, parseInt(v) || 1))} />
                  ) : l.qty}
                </td>
                <td style={{ padding: '7px 0', textAlign: 'right' }}>{unitMoney(l.unitPrice, currency)}</td>
                <td style={{ padding: '7px 0', textAlign: 'right' }}>{m(lineAnnual(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Notice tone="warn">
          <strong>Check the products, quantities and currency are correct before you continue.</strong>
        </Notice>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 8 }}>
          Edit quantities and currency here. To add or remove products, or change the tier,{' '}
          <button type="button" onClick={onBack} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--blue-500)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
            go back to the calculator
          </button>
          . Everything you&apos;ve entered below is kept.
        </div>
      </Section>

      <Section n={2} title="Select the opportunity">
        <OpportunityPicker selected={opp} onSelect={selectOpp} />
        {opp && (
          <>
            {!opp.contact && <Notice tone="warn">No primary contact on this opportunity</Notice>}
            <div style={{ ...GRID, marginTop: 16 }}>
              <Field label="School name"><TextInput value={schoolName} onChange={set('schoolName')} /></Field>
              <Field label="SIS"><TextInput value={sis} onChange={set('sis')} /></Field>
              <Field label="Contact name"><TextInput value={contactName} onChange={set('contactName')} /></Field>
              <Field label="Contact title (optional)"><TextInput value={contactTitle} onChange={set('contactTitle')} /></Field>
              <Field label="Rep name"><TextInput value={repName} onChange={set('repName')} /></Field>
              <Field label="Rep email"><TextInput type="email" value={repEmail} onChange={set('repEmail')} /></Field>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 10 }}>
              Salesforce: {opp.name} ({opp.id}){opp.stage && ` · ${opp.stage}`}
            </div>
          </>
        )}
      </Section>

      <Section n={3} title="Deal details">
        <div style={GRID}>
          <Field label="Proposal date">
            <TextInput type="date" value={proposalDate} onChange={set('proposalDate')} />
          </Field>
          <Field label="Expiry date" hint={`Max ${EXPIRY_MAX_DAYS} days after the proposal date`}>
            <TextInput type="date" value={expiryDate} min={proposalDate} max={proposalDate ? addDays(proposalDate, EXPIRY_MAX_DAYS) : undefined} onChange={set('expiryDate')} />
          </Field>
          <Field label="Currency" hint="Change it in step 1">
            <TextInput value={currency} onChange={() => {}} readOnly style={{ background: 'var(--bg-subtle)' }} />
          </Field>
          <Field label="School year start" hint="Starts on the 1st of the month">
            <select value={syMonth} onChange={e => onDraftChange({ syMonth: parseInt(e.target.value) })} style={INPUT}>
              {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
            </select>
          </Field>
          <Field label="Term length">
            <select value={termYears} onChange={e => onDraftChange({ termYears: parseInt(e.target.value) })} style={INPUT}>
              {[1, 2, 3].map(y => <option key={y} value={y}>{y} year{y > 1 ? 's' : ''}</option>)}
            </select>
          </Field>
          <Field label="Start / access date" hint="Always the 1st of the month">
            <TextInput type="date" value={startDate} onChange={v => onDraftChange({ startDate: v ? `${v.slice(0, 8)}01` : '' })} />
          </Field>
        </div>
        {startDate && (
          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 12 }}>
            School year starts {formatLong(result.schoolYearStartDate)} · Contract ends {formatLong(result.contractEnd)}
          </div>
        )}
      </Section>

      <Section n={4} title="Offers to include">
        <OfferCheckbox
          checked={include.standard}
          onChange={v => onDraftChange({ include: { ...include, standard: v } })}
          title={`Standard: “${OFFER_LABELS.standard.tagline}”`}
          desc="Access and billing from the start date. A pro-rated stub until the school year start, then annual."
        />
        <OfferCheckbox
          checked={include.funded && !fundedDisabled}
          disabled={fundedDisabled}
          onChange={v => onDraftChange({ include: { ...include, funded: v } })}
          title={`Special Funded Offer Program: “${OFFER_LABELS.funded.tagline}”`}
          desc="Free access from the access date, billing from the next school year start."
        />
        {fundedDisabled && <Notice tone="info">Funded requires access before the school year start</Notice>}
        {bothSelected && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: 'var(--fg-2)' }}>Recommended option:</span>
            {(['standard', 'funded'] as OfferType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => onDraftChange({ recommended: t })}
                className={styles.toggleBtn}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  border: `2px solid ${recommended === t ? 'var(--navy-900)' : 'var(--border-strong)'}`,
                  background: recommended === t ? 'var(--navy-900)' : 'var(--bg)',
                  color: recommended === t ? '#fff' : 'var(--navy-900)',
                }}
              >
                {t === 'standard' ? 'Standard' : 'Funded'}
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section n={5} title="Discounts" aside={policyLink}>
        {result.options.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-3)' }}>Select at least one offer above.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {result.options.map(o => (
            <div key={o.type} style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: 14 }}>
              <div style={{ fontWeight: 700, color: 'var(--navy-900)', fontSize: 14, marginBottom: 12 }}>
                Option {o.letter.toUpperCase()} · {o.type === 'standard' ? 'Standard' : 'Funded'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Subscription discount %" hint={`${m(o.discountAmount)} off · max ${DISCOUNT_POLICY.subscriptionMaxPct}%`}>
                  <TextInput type="number" min={0} max={100} step={1} value={discount[o.type]} onChange={v => onDraftChange({ discount: { ...discount, [o.type]: v.replace(/\D/g, '') } })} />
                </Field>
                <Field label="One-time fees discount %" hint={`${m(o.oneTimeFees.discountAmount)} off · max ${DISCOUNT_POLICY.oneTimeMaxPct}%`}>
                  <TextInput type="number" min={0} max={100} step={1} value={oneTimeDiscount[o.type]} onChange={v => onDraftChange({ oneTimeDiscount: { ...oneTimeDiscount, [o.type]: v.replace(/\D/g, '') } })} />
                </Field>
              </div>
            </div>
          ))}
        </div>
        {policy.status === 'needs_approval' && (
          <Notice tone="warn">
            <strong>Above the Discount &amp; Terms Policy limits:</strong>
            <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
              {policy.items.map(i => <li key={i}>{i}</li>)}
            </ul>
            Make sure you have approval from {DISCOUNT_POLICY.approvers} before sending this proposal.
          </Notice>
        )}
      </Section>

      <Section n={6} title="Offer summary">
        {result.options.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-3)' }}>Select at least one offer above.</p>}
        {result.options.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
            {result.options.map(o => (
              <OfferSummary
                key={o.type}
                offer={o}
                lines={lines}
                listTotal={result.listTotal}
                contractEnd={result.contractEnd}
                currency={currency}
                recommended={bothSelected && o.type === recommended}
              />
            ))}
          </div>
        )}

      </Section>

      <Section n={7} title="Rollout timeline">
        <div style={GRID}>
          <Field label="Sign-by date" hint={signBy === null ? 'Defaults to the expiry date; can be later (accepting the offer, before the contract)' : undefined}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <TextInput type="date" value={signBy ?? expiryDate} min={proposalDate} onChange={set('signBy')} />
              {signBy !== null && (
                <button type="button" onClick={() => onDraftChange({ signBy: null })} style={{ border: 'none', background: 'none', color: 'var(--blue-500)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
                  Reset
                </button>
              )}
            </div>
          </Field>
          <Field label="Onboarding kickoff">
            <TextInput type="date" value={kickoff} onChange={set('kickoff')} />
          </Field>
          <Field label="Integration and setup window"><TextInput value={setupWindow} onChange={set('setupWindow')} placeholder="Nov–Dec 2026" /></Field>
          <Field label="Training window"><TextInput value={trainingWindow} onChange={set('trainingWindow')} placeholder="Jan–Jun 2027" /></Field>
          <Field label="Go-live date" hint={goLive === null ? 'Defaults to the Funded billing start, or the Standard start date' : undefined}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <TextInput type="date" value={goLive ?? defaultGoLive} onChange={set('goLive')} />
              {goLive !== null && (
                <button type="button" onClick={() => onDraftChange({ goLive: null })} style={{ border: 'none', background: 'none', color: 'var(--blue-500)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
                  Reset
                </button>
              )}
            </div>
          </Field>
        </div>
        <div style={{ marginTop: 14 }}>
          <Field label="Implementation notes (optional)">
            <textarea value={notes} rows={3} onChange={e => onDraftChange({ notes: e.target.value })} style={{ ...INPUT, width: '100%', resize: 'vertical' }} />
          </Field>
        </div>
      </Section>

      <Section n={8} title="Generate the proposal">
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: 'var(--fg-1)', lineHeight: 1.7 }}>
          <li>Click <strong>Send to Claude</strong>. A new Claude chat opens with the proposal brief already in the message box.</li>
          <li>Press <strong>Enter</strong> to generate the proposal slide deck.</li>
          <li>Alternatively, <strong>Copy to clipboard</strong> and paste the brief into a Claude chat yourself, or <strong>Download .txt</strong> and upload the file.</li>
          <li>Check the deck against the offer summary above before sending it to the school.</li>
        </ol>
        {missing.length > 0 && (
          <Notice tone="warn">
            <strong>Still needed:</strong> {missing.join(', ')}
          </Notice>
        )}
        {policy.status === 'needs_approval' && (
          <Notice tone="warn">Discounts are above the policy limits. Make sure you have approval from {DISCOUNT_POLICY.approvers} before sending this proposal.</Notice>
        )}

        <a
          href={canGenerate ? claudeUrl : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!canGenerate}
          onClick={e => { if (!canGenerate) e.preventDefault(); else sendToClaude() }}
          className={canGenerate ? styles.primaryBtn : undefined}
          style={{
            display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 16, padding: '13px 16px', borderRadius: 6,
            background: 'var(--navy-900)', color: '#fff', fontWeight: 700, fontSize: 15,
            cursor: canGenerate ? 'pointer' : 'not-allowed', opacity: canGenerate ? 1 : 0.45,
          }}
        >
          ✨ Send to Claude
        </a>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <button
            type="button"
            disabled={!canGenerate}
            onClick={copy}
            className={canGenerate ? styles.secondaryBtn : undefined}
            style={{ padding: '10px 16px', borderRadius: 6, border: '2px solid var(--navy-900)', background: 'var(--bg)', color: 'var(--navy-900)', fontWeight: 600, fontSize: 13, cursor: canGenerate ? 'pointer' : 'not-allowed', opacity: canGenerate ? 1 : 0.45 }}
          >
            {copied ? '✓ Copied' : '📋 Copy to clipboard'}
          </button>
          <button
            type="button"
            disabled={!canGenerate}
            onClick={download}
            className={canGenerate ? styles.secondaryBtn : undefined}
            style={{ padding: '10px 16px', borderRadius: 6, border: '2px solid var(--navy-900)', background: 'var(--bg)', color: 'var(--navy-900)', fontWeight: 600, fontSize: 13, cursor: canGenerate ? 'pointer' : 'not-allowed', opacity: canGenerate ? 1 : 0.45 }}
          >
            ⬇️ Download .txt
          </button>
        </div>

        {canGenerate ? (
          <textarea
            readOnly
            value={text}
            rows={Math.min(40, text.split('\n').length + 1)}
            onFocus={e => e.target.select()}
            style={{ ...INPUT, width: '100%', marginTop: 14, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, lineHeight: 1.5, background: 'var(--bg-subtle)', resize: 'vertical' }}
          />
        ) : (
          <div style={{ marginTop: 14, padding: 24, textAlign: 'center', border: '1px dashed var(--border-strong)', borderRadius: 8, color: 'var(--fg-3)', fontSize: 13 }}>
            The brief appears here once everything above is complete.
          </div>
        )}
      </Section>
    </div>
  )
}

function OfferCheckbox({ checked, disabled, onChange, title, desc }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; title: string; desc: string }) {
  return (
    <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', border: `1px solid ${checked ? 'var(--navy-900)' : 'var(--border-strong)'}`, borderRadius: 8, padding: 14, marginBottom: 10, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, background: checked ? 'var(--blue-50)' : 'var(--bg)' }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-900)' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 2 }}>{desc}</div>
      </div>
    </label>
  )
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '3px 0', fontWeight: bold ? 700 : 400, color: bold ? 'var(--navy-900)' : muted ? 'var(--fg-3)' : 'var(--fg-1)' }}>
      <span>{label}</span>
      <span style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  )
}

/** One option, laid out identically for Standard and Funded so they compare side by side. */
function OfferSummary({ offer, lines, listTotal, contractEnd, currency, recommended }: {
  offer: ComputedOffer
  lines: LineItem[]
  listTotal: number
  contractEnd: string
  currency: QuoteInput['currency']
  recommended: boolean
}) {
  const m = (n: number) => money(n, currency)
  const NA = '—'
  return (
    <div style={{ border: `${recommended ? 2 : 1}px solid ${recommended ? 'var(--navy-900)' : 'var(--border-strong)'}`, borderRadius: 8, padding: 16, fontSize: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--navy-900)' }}>
            Option {offer.letter.toUpperCase()} · {offer.type === 'standard' ? 'Standard' : 'Funded'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{OFFER_LABELS[offer.type].tagline}</div>
        </div>
        {recommended && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--navy-900)', borderRadius: 4, padding: '3px 7px', whiteSpace: 'nowrap' }}>Recommended</span>
        )}
      </div>

      <Group title="Line items">
        {lines.map(l => (
          <Row key={l.product} label={`${l.product} · ${l.qty} × ${unitMoney(l.unitPrice, currency)}`} value={m(lineAnnual(l))} />
        ))}
      </Group>

      <Group title="Term">
        <Row label="Start / access date" value={formatShort(offer.startOrAccessDate)} />
        <Row label="Billing starts" value={formatShort(offer.billingStarts)} />
        <Row label="Paid term" value={months(offer.paidTermMonths)} />
        <Row label="Contract end" value={formatShort(contractEnd)} />
        <Row label="Early access (free)" value={offer.earlyAccessPeriod ?? NA} muted={!offer.earlyAccessPeriod} />
      </Group>

      <Group title="Subscription">
        <Row label="List total" value={m(listTotal)} />
        <Row label={`Discount (${offer.discountPct}%)`} value={`−${m(offer.discountAmount)}`} />
        <Row label="Annual" value={m(offer.annual)} bold />
        <Row label="Annual saving vs Funded" value={offer.annualSaving !== undefined ? m(offer.annualSaving) : NA} muted={offer.annualSaving === undefined} />
      </Group>

      <Group title="One-time fees">
        {offer.oneTimeFees.lines.map((l, i) => (
          <Row key={l.product} label={i === 0 ? l.product : `${l.product} × ${l.qty}`} value={m(lineAnnual(l))} />
        ))}
        <Row label="List" value={m(offer.oneTimeFees.list)} />
        <Row label={`Discount (${offer.oneTimeFees.discountPct}%)`} value={`−${m(offer.oneTimeFees.discountAmount)}`} />
        <Row label="Total" value={m(offer.oneTimeFees.total)} bold />
      </Group>

      <Group title="Due at signature">
        <Row label="One-time fees" value={m(offer.oneTimeFees.total)} />
        <Row
          label={offer.stubMonths > 0 ? `Pro-rated stub (${offer.proratedPeriod}, ${months(offer.stubMonths)})` : 'Pro-rated stub'}
          value={offer.stubMonths > 0 ? m(offer.stub) : NA}
          muted={offer.stubMonths === 0}
        />
        <Row label="Due at signature" value={m(offer.dueAtSignature)} bold />
      </Group>

      <Group title="Payment schedule">
        {offer.schedule.map(r => <Row key={r.date} label={formatLong(r.date)} value={m(r.amount)} />)}
      </Group>
    </div>
  )
}
