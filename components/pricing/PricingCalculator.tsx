'use client'

import { useEffect, useMemo, useState } from 'react'
import { ONE_TIME_FEES, TIERS, type CurrencyCode, type OneTimeFee, type Platform, type TierAddon } from '@/lib/pricing/data'
import { MIN_STUDENTS, calculateQuote, currencyName, currencySymbol, findTier, formatAddonPrice, formatMoney, getPrice, quoteToText, type Quote } from '@/lib/pricing/calc'
import { CurrencySelect, PageHeader, PlatformToggle } from './Controls'
import OfferBuilder from './offer/OfferBuilder'
import styles from './pricing.module.css'

/** Per add-on selection. `all` = quantity follows the student count. */
interface AddonSelection {
  qty: number
  all: boolean
}

const PANEL: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  boxShadow: 'var(--shadow-1)',
  padding: 28,
}

const MUTED_NOTE: React.CSSProperties = { color: 'var(--fg-3)', textAlign: 'center', padding: 16, fontSize: 13, margin: 0 }

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--navy-900)', margin: '0 0 12px' }}>
        {n}. {title}
      </h2>
      {children}
    </section>
  )
}

function AddonRow({
  addon, currency, selection, studentCount, capAtStudents, onToggle, onQty, onAll,
}: {
  addon: TierAddon
  currency: CurrencyCode
  selection: AddonSelection | undefined
  studentCount: number
  capAtStudents: boolean
  onToggle: (checked: boolean) => void
  onQty: (qty: number) => void
  onAll: (all: boolean) => void
}) {
  const checked = selection != null
  return (
    <div style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: 14, marginBottom: 10, background: 'var(--bg)' }}>
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-900)' }}>
            {addon.name}{addon.note && <span style={{ color: 'var(--orange-700)' }}> *</span>}
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>{formatAddonPrice(addon, currency)}</div>
        </div>
        <input type="checkbox" checked={checked} onChange={e => onToggle(e.target.checked)} style={{ width: 20, height: 20, cursor: 'pointer' }} />
      </label>

      {addon.note && (
        <div style={{ fontSize: 12, color: 'var(--orange-700)', marginTop: 6 }}>* {addon.note}</div>
      )}

      {addon.includedInTier && (
        <div style={{ background: 'var(--blue-50)', borderLeft: '3px solid var(--blue-500)', padding: '10px 12px', marginTop: 10, borderRadius: 4, fontSize: 12, color: 'var(--blue-700)' }}>
          ✓ Included for base platform students. Add more students for day school if needed.
        </div>
      )}

      {checked && addon.perStudent && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12, marginTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, color: 'var(--fg-2)' }} htmlFor={`qty-${addon.id}`}>Students:</label>
          <input
            id={`qty-${addon.id}`}
            type="number"
            className={styles.qtyInput}
            min={1}
            max={capAtStudents ? studentCount : undefined}
            value={selection.qty}
            onChange={e => onQty(parseInt(e.target.value) || 0)}
            style={{ flex: 1, minWidth: 100, padding: '7px 10px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 14, fontWeight: 600 }}
          />
          {!addon.includedInTier && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--fg-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={selection.all} onChange={e => onAll(e.target.checked)} style={{ width: 16, height: 16 }} />
              All {capAtStudents ? '' : 'base platform '}students
            </label>
          )}
        </div>
      )}
    </div>
  )
}

function OneTimeFeeRow({ fee, currency, qty, onChange }: { fee: OneTimeFee; currency: CurrencyCode; qty: number | undefined; onChange: (qty: number | undefined) => void }) {
  const checked = qty != null
  return (
    <div style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: 14, marginBottom: 10, background: 'var(--bg)' }}>
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-900)' }}>{fee.name}</div>
          <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>{formatMoney(getPrice(fee.prices, currency), currency)} one-time</div>
        </div>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked ? 1 : undefined)} style={{ width: 20, height: 20, cursor: 'pointer' }} />
      </label>
      {checked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12, marginTop: 12, borderTop: '1px solid var(--border)' }}>
          <label style={{ fontSize: 13, color: 'var(--fg-2)' }} htmlFor={`otf-${fee.id}`}>Quantity:</label>
          <input
            id={`otf-${fee.id}`}
            type="number"
            className={styles.qtyInput}
            min={1}
            value={qty}
            onChange={e => onChange(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ flex: 1, minWidth: 100, padding: '7px 10px', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: 14, fontWeight: 600 }}
          />
        </div>
      )}
    </div>
  )
}

function SummaryRow({ label, sub, value, bold }: { label: string; sub?: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
      <div style={{ fontSize: 14, color: 'var(--fg-1)' }}>
        <div style={{ fontWeight: bold ? 700 : 400 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--fg-3)', marginLeft: bold ? 0 : 10 }}>{sub}</div>}
      </div>
      <div style={{ fontWeight: 600, color: 'var(--navy-900)', fontSize: 14, whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )
}

function Summary({ quote, currency, copied, onCopy }: { quote: Quote | null; currency: CurrencyCode; copied: boolean; onCopy: () => void }) {
  if (!quote) {
    return (
      <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--fg-3)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
        <p style={{ margin: 0 }}>Select a tier to see pricing</p>
      </div>
    )
  }
  const m = (n: number) => formatMoney(n, currency)
  const divider: React.CSSProperties = { borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 14 }
  const bigNumber: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--green-600)' }

  return (
    <div>
      <div style={divider}>
        <SummaryRow bold label={quote.tier.name} sub={`${quote.studentCount} students × ${m(quote.tierPrice)}`} value={m(quote.baseCost)} />
      </div>

      {quote.addonLines.length > 0 && (
        <div style={divider}>
          <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--navy-900)', fontSize: 14 }}>Add-ons:</div>
          {quote.addonLines.map(l => (
            <SummaryRow
              key={l.name}
              label={l.note ? `${l.name}*` : l.name}
              sub={(l.perStudent ? `${l.quantity} students` : 'Flat fee') + (l.note ? ` · *${l.note}` : '')}
              value={m(l.cost)}
            />
          ))}
        </div>
      )}

      <SummaryRow bold label={quote.tier.onboarding.name} sub="One-time setup fee" value={m(quote.onboardingFee)} />

      {quote.oneTimeLines.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--navy-900)', fontSize: 14 }}>Additional one-time fees:</div>
          {quote.oneTimeLines.map(l => (
            <SummaryRow key={l.name} label={l.name} sub={`${l.quantity} × ${m(l.unitPrice)}`} value={m(l.cost)} />
          ))}
        </div>
      )}

      <div style={{ background: 'var(--bg-subtle)', padding: 18, borderRadius: 8, marginTop: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy-900)', textAlign: 'center', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Grand Total
        </div>
        <div style={{ ...divider, borderColor: 'var(--border-strong)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: 'var(--navy-900)' }}>Annual Recurring</span>
            <span style={bigNumber}>{m(quote.annual)}</span>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--fg-3)' }}>
            {currencySymbol(currency)}{quote.perStudent.toFixed(2)}/student/year
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: 'var(--navy-900)' }}>Total Year 1</span>
          <span style={bigNumber}>{m(quote.year1)}</span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>Includes {m(quote.onboardingFee)} onboarding{quote.oneTimeTotal > 0 && ` + ${m(quote.oneTimeTotal)} one-time fees`}</div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--fg-3)', marginTop: 14 }}>
        <strong>Currency:</strong> {currency} ({currencyName(currency)})
      </div>

      <div className={styles.noPrint} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => window.print()}
          style={{ padding: '10px 16px', borderRadius: 6, border: '2px solid var(--navy-900)', background: 'var(--bg)', color: 'var(--navy-900)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        >
          🖨️ Print
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={onCopy}
          style={{ padding: '10px 16px', borderRadius: 6, border: 'none', background: 'var(--navy-900)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
      </div>
    </div>
  )
}

export default function PricingCalculator() {
  const [platform, setPlatform] = useState<Platform>('supervise')
  const [currency, setCurrency] = useState<CurrencyCode>('USD')
  const [studentInput, setStudentInput] = useState('500')
  const [tierId, setTierId] = useState<string | null>(null)
  const [selections, setSelections] = useState<Record<string, AddonSelection>>({})
  /** one-time fee id → packs; plan-independent, so kept across tier/platform changes */
  const [oneTimeFees, setOneTimeFees] = useState<Record<string, number>>({})
  const [copied, setCopied] = useState(false)
  const [offerMode, setOfferMode] = useState(false)

  const rawStudents = parseInt(studentInput) || 0
  const studentCount = Math.max(MIN_STUDENTS, rawStudents)
  const belowMin = rawStudents > 0 && rawStudents < MIN_STUDENTS
  // Supervise add-ons can't exceed the school's student count; Boarding add-ons can (e.g. extra day students).
  const capAtStudents = platform === 'supervise'
  const tier = findTier(platform, tierId)

  const quoteInput = useMemo(() => {
    if (!tierId) return null
    const addons: Record<string, number> = {}
    for (const [id, sel] of Object.entries(selections)) {
      const addon = tier?.addons.find(a => a.id === id)
      if (!addon) continue
      let qty = addon.perStudent ? (sel.all ? studentCount : sel.qty) : 1
      if (addon.perStudent && capAtStudents) qty = Math.min(qty, studentCount)
      addons[id] = Math.max(1, qty)
    }
    return { platform, currency, studentCount, tierId, addons, oneTimeFees }
  }, [platform, currency, studentCount, tierId, selections, tier, capAtStudents, oneTimeFees])

  const quote = quoteInput ? calculateQuote(quoteInput) : null

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  function changePlatform(p: Platform) {
    setPlatform(p)
    setTierId(null)
    setSelections({})
  }

  function selectTier(id: string) {
    setTierId(id)
    setSelections({})
  }

  function stepStudents(delta: number) {
    setStudentInput(String(Math.max(MIN_STUDENTS, (parseInt(studentInput) || 0) + delta)))
  }

  function toggleAddon(addon: TierAddon, checked: boolean) {
    setSelections(prev => {
      const next = { ...prev }
      if (checked) next[addon.id] = { qty: studentCount, all: !addon.includedInTier }
      else delete next[addon.id]
      return next
    })
  }

  function setAddonQty(addon: TierAddon, qty: number) {
    let v = Math.max(1, qty)
    if (capAtStudents) v = Math.min(v, studentCount)
    setSelections(prev => ({ ...prev, [addon.id]: { qty: v, all: false } }))
  }

  function setAddonAll(addon: TierAddon, all: boolean) {
    setSelections(prev => ({ ...prev, [addon.id]: { qty: all ? studentCount : prev[addon.id]?.qty ?? studentCount, all } }))
  }

  async function copy() {
    if (!quote || !quoteInput) return
    await navigator.clipboard.writeText(quoteToText(quote, quoteInput))
    setCopied(true)
  }

  if (offerMode && quote && quoteInput) {
    return <OfferBuilder quote={quote} quoteInput={quoteInput} onBack={() => setOfferMode(false)} />
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader title="Pricing Calculator" subtitle="Configure a plan and see list pricing in real time.">
        <CurrencySelect value={currency} onChange={setCurrency} />
      </PageHeader>

      <div className={styles.calcLayout}>
        {/* Configuration */}
        <div className={styles.configPanel} style={PANEL}>
          <Section n={1} title="Select Platform">
            <PlatformToggle value={platform} onChange={changePlatform} />
          </Section>

          <Section n={2} title="Number of Students">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="number"
                className={styles.studentInput}
                min={MIN_STUDENTS}
                value={studentInput}
                onChange={e => setStudentInput(e.target.value)}
                aria-label="Number of students"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: 12,
                  fontSize: 28,
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--navy-900)',
                  border: `2px solid ${belowMin ? 'var(--red-500)' : 'var(--border-strong)'}`,
                  borderRadius: 8,
                  textAlign: 'center',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[100, -100].map(d => (
                  <button
                    key={d}
                    type="button"
                    className={styles.stepBtn}
                    onClick={() => stepStudents(d)}
                    aria-label={d > 0 ? 'Add 100 students' : 'Remove 100 students'}
                    style={{ width: 40, height: 34, border: '2px solid var(--navy-900)', background: 'var(--bg)', color: 'var(--navy-900)', fontSize: 18, fontWeight: 700, borderRadius: 6, cursor: 'pointer' }}
                  >
                    {d > 0 ? '+' : '−'}
                  </button>
                ))}
              </div>
            </div>
            {belowMin && (
              <div style={{ color: 'var(--red-500)', fontSize: 13, marginTop: 8, fontWeight: 500 }}>
                ⚠️ Minimum {MIN_STUDENTS} students required. Pricing is calculated at {MIN_STUDENTS}.
              </div>
            )}
          </Section>

          <Section n={3} title="Select Tier">
            <div className={styles.tierGrid}>
              {TIERS[platform].map(t => {
                const active = t.id === tierId
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={styles.tierCard}
                    onClick={() => selectTier(t.id)}
                    style={{
                      border: `2px solid ${active ? 'var(--navy-900)' : 'var(--border-strong)'}`,
                      borderRadius: 10,
                      padding: '20px 14px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: active ? 'var(--blue-50)' : 'var(--bg)',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--navy-900)', marginBottom: 4 }}>{t.name}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy-900)' }}>{formatMoney(getPrice(t.prices, currency), currency)}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>/student/year</div>
                  </button>
                )
              })}
            </div>
          </Section>

          <Section n={4} title="Add-ons (Optional)">
            {!tier ? (
              <p style={MUTED_NOTE}>Select a tier to see available add-ons</p>
            ) : tier.addons.length === 0 ? (
              <p style={MUTED_NOTE}>No add-ons available for this tier</p>
            ) : (
              tier.addons.map(a => {
                const sel = selections[a.id]
                return (
                  <AddonRow
                    key={a.id}
                    addon={a}
                    currency={currency}
                    selection={sel && { ...sel, qty: sel.all ? studentCount : capAtStudents ? Math.min(sel.qty, studentCount) : sel.qty }}
                    studentCount={studentCount}
                    capAtStudents={capAtStudents}
                    onToggle={checked => toggleAddon(a, checked)}
                    onQty={qty => setAddonQty(a, qty)}
                    onAll={all => setAddonAll(a, all)}
                  />
                )
              })
            )}
          </Section>

          <Section n={5} title="Onboarding (Required)">
            {!tier ? (
              <p style={MUTED_NOTE}>Select a tier to see onboarding fee</p>
            ) : (
              <div style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: 18, background: 'var(--bg-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--navy-900)' }}>{tier.onboarding.name}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy-900)' }}>{formatMoney(getPrice(tier.onboarding.prices, currency), currency)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-3)', fontStyle: 'italic' }}>One-time setup fee • Included with {tier.name} tier</div>
              </div>
            )}
          </Section>

          <Section n={6} title="Additional One-Time Fees (Optional)">
            {ONE_TIME_FEES.map(f => (
              <OneTimeFeeRow
                key={f.id}
                fee={f}
                currency={currency}
                qty={oneTimeFees[f.id]}
                onChange={qty => setOneTimeFees(prev => {
                  const next = { ...prev }
                  if (qty == null) delete next[f.id]
                  else next[f.id] = qty
                  return next
                })}
              />
            ))}
          </Section>
        </div>

        {/* Summary */}
        <div>
          <div className={styles.summaryPanel} style={PANEL}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--navy-900)', textAlign: 'center', margin: '0 0 20px' }}>
              Pricing Summary
            </h2>
            <Summary quote={quote} currency={currency} copied={copied} onCopy={copy} />
          </div>
          {quote && (
            <button
              type="button"
              className={`${styles.primaryBtn} ${styles.noPrint}`}
              onClick={() => { setOfferMode(true); window.scrollTo(0, 0) }}
              style={{ display: 'block', width: '100%', marginTop: 16, padding: '14px 16px', borderRadius: 8, border: 'none', background: 'var(--blue-500)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: 'var(--shadow-1)' }}
            >
              Generate Proposal Offer →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
