'use client'

import { useState } from 'react'
import { ONE_TIME_FEES, TABLE_ADDONS, TABLE_FEATURES, TIERS, type CurrencyCode, type Platform, type Tier } from '@/lib/pricing/data'
import { formatAddonPrice, formatMoney, getPrice } from '@/lib/pricing/calc'
import { CurrencySelect, PageHeader, PlatformToggle } from './Controls'
import styles from './pricing.module.css'

const CARD: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  boxShadow: 'var(--shadow-1)',
}

function Check() {
  return <span style={{ color: 'var(--green-600)', fontWeight: 700 }}>✓</span>
}

function PopularBadge({ style }: { style?: React.CSSProperties }) {
  return (
    <span style={{
      background: 'var(--navy-900)',
      color: '#fff',
      padding: '3px 12px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      whiteSpace: 'nowrap',
      ...style,
    }}>
      Most Popular
    </span>
  )
}

function PlanCard({ tier, currency }: { tier: Tier; currency: CurrencyCode }) {
  return (
    <div
      className={styles.planCard}
      style={{
        ...CARD,
        position: 'relative',
        height: '100%',
        padding: '30px 20px 24px',
        border: tier.featured ? '2px solid var(--navy-900)' : '1px solid var(--border)',
      }}
    >
      {tier.featured && <PopularBadge style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)' }} />}
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--navy-900)', margin: '0 0 4px' }}>
        {tier.name}
      </h3>
      <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '0 0 20px', minHeight: 20 }}>{tier.description}</p>
      <div style={{ marginBottom: 24 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'var(--navy-900)' }}>
          {formatMoney(getPrice(tier.prices, currency), currency)}
        </span>
        <span style={{ fontSize: 14, color: 'var(--fg-3)' }}>/student/year</span>
        {tier.boardingUplift && (
          <div style={{ fontSize: 12, color: 'var(--fg-3)', fontStyle: 'italic', marginTop: 6 }}>
            +{formatMoney(getPrice(tier.boardingUplift, currency), currency)} for boarding students
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy-900)', marginBottom: 8 }}>{tier.includesPrefix}</div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {tier.cardFeatures.map(f => (
          <li key={f} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.4 }}>
            <Check />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CompareTable({ platform, currency }: { platform: Platform; currency: CurrencyCode }) {
  const tiers = TIERS[platform]
  const cols = `2fr repeat(${tiers.length}, 1fr)`
  const addons = TABLE_ADDONS[platform]

  const sectionRow = (label: string, strong = false) => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: cols,
      background: 'var(--bg-subtle)',
      borderTop: strong ? '3px solid var(--navy-900)' : undefined,
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        padding: strong ? '16px 24px' : '12px 24px',
        fontSize: strong ? 14 : 12,
        fontWeight: 700,
        color: 'var(--navy-900)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        {label}
      </div>
    </div>
  )

  const cell: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', fontSize: 13, color: 'var(--fg-1)', textAlign: 'center' }

  return (
    <div className={styles.compareTable}>
      {/* Plan cards sit on the same column grid as the table, one above each plan column */}
      <div style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'stretch', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 24px 8px 0' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--navy-900)', margin: 0 }}>Compare Plans</h2>
          <p style={{ fontSize: 14, color: 'var(--fg-2)', margin: '4px 0 0' }}>What&apos;s included in each plan, with the full feature breakdown below.</p>
        </div>
        {tiers.map(t => (
          <div key={t.id} style={{ padding: '12px 8px 0' }}>
            <PlanCard tier={t} currency={currency} />
          </div>
        ))}
      </div>

      {/* overflow: clip (not hidden) keeps the rounded corners without breaking the sticky header */}
      <div style={{ ...CARD, overflow: 'clip' }}>
        {/* Sticky plan-name header — stays under the TopBar (56px) while scrolling the feature rows */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: cols,
          position: 'sticky',
          top: 56,
          zIndex: 5,
          background: 'var(--bg)',
          borderBottom: '2px solid var(--border)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
        }}>
          <div style={{ padding: '12px 24px', fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', alignSelf: 'center' }}>Features</div>
          {tiers.map(t => (
            <div key={t.id} style={{ padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--navy-900)' }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{formatMoney(getPrice(t.prices, currency), currency)}/student/year</div>
            </div>
          ))}
        </div>
      {/* Feature categories */}
      {Object.entries(TABLE_FEATURES[platform]).map(([category, features]) => (
        <div key={category}>
          {sectionRow(category)}
          {features.map(f => (
            <div key={f.name} className={styles.tableRow} style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ padding: '12px 24px', fontSize: 14, color: 'var(--fg-1)' }}>{f.name}</div>
              {tiers.map(t => {
                const paid = f.paidTiers?.[t.id]
                return (
                  <div key={t.id} style={cell}>
                    {paid ? <span style={{ fontWeight: 500 }}>{formatAddonPrice(paid, currency)}</span> : f.tiers.includes(t.id) ? <Check /> : null}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      ))}

      {/* Add-ons */}
      {addons.length > 0 && (
        <div>
          {sectionRow('Add-ons', true)}
          {addons.map(({ addon, tiers: available }) => (
            <div key={addon.id} className={styles.tableRow} style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ padding: '12px 24px', fontSize: 14, color: 'var(--fg-1)' }}>{addon.name}</div>
              {tiers.map(t => (
                <div key={t.id} style={cell}>{available.includes(t.id) ? formatAddonPrice(addon, currency) : null}</div>
              ))}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}

function OneTimeFees({ currency }: { currency: CurrencyCode }) {
  return (
    <section style={{ ...CARD, overflow: 'clip', marginTop: 32 }}>
      <div style={{ padding: '18px 24px', borderTop: '3px solid var(--navy-900)', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--navy-900)', margin: 0 }}>Additional One-Time Fees</h2>
        <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '2px 0 0' }}>Optional purchases, available on every plan.</p>
      </div>
      {ONE_TIME_FEES.map(f => (
        <div key={f.id} className={styles.tableRow} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', fontSize: 14 }}>
          <span style={{ color: 'var(--fg-1)' }}>{f.name}</span>
          <span style={{ fontWeight: 600, color: 'var(--navy-900)', whiteSpace: 'nowrap' }}>
            {formatMoney(getPrice(f.prices, currency), currency)} <span style={{ fontWeight: 400, color: 'var(--fg-3)', fontSize: 12 }}>one-time</span>
          </span>
        </div>
      ))}
    </section>
  )
}

export default function PricingOverview() {
  const [currency, setCurrency] = useState<CurrencyCode>('USD')
  const [platform, setPlatform] = useState<Platform>('supervise')

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader title="Pricing Overview" subtitle="Packages, what's included, and list prices per student per year.">
        <PlatformToggle value={platform} onChange={setPlatform} />
        <CurrencySelect value={currency} onChange={setCurrency} />
      </PageHeader>

      <CompareTable platform={platform} currency={currency} />

      {/* Below 968px the comparison grid is hidden — fall back to stacked plan cards */}
      <div className={`${styles.planGrid} ${styles.narrowOnly}`} style={{ paddingTop: 12 }}>
        {TIERS[platform].map(t => <PlanCard key={t.id} tier={t} currency={currency} />)}
      </div>

      <OneTimeFees currency={currency} />
    </div>
  )
}
