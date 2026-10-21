// Small shared form primitives for the offer builder (inline styles + CSS tokens).

export const INPUT: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'inherit',
  color: 'var(--fg-1)',
  background: 'var(--bg)',
  boxSizing: 'border-box',
}

export const GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
}

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: 'var(--fg-2)', minWidth: 0 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{hint}</span>}
    </label>
  )
}

export function TextInput({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <input {...rest} value={value} onChange={e => onChange(e.target.value)} style={{ ...INPUT, width: '100%', ...rest.style }} />
}

export function Notice({ tone, children }: { tone: 'warn' | 'error' | 'info'; children: React.ReactNode }) {
  const colors = {
    warn: { bg: 'var(--amber-50)', border: 'var(--amber-400)', fg: 'var(--amber-700)' },
    error: { bg: 'var(--red-50)', border: 'var(--red-500)', fg: 'var(--red-700)' },
    info: { bg: 'var(--blue-50)', border: 'var(--blue-500)', fg: 'var(--blue-700)' },
  }[tone]
  return (
    <div style={{ background: colors.bg, borderLeft: `3px solid ${colors.border}`, color: colors.fg, padding: '10px 12px', borderRadius: 4, fontSize: 13, marginTop: 10 }}>
      {children}
    </div>
  )
}
