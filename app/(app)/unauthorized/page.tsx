import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div style={{ maxWidth: 480, margin: '64px auto', textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 22 }}>
        🔒
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 8 }}>Access restricted</h1>
      <p style={{ fontSize: 14, color: 'var(--fg-3)', lineHeight: 1.7, marginBottom: 28 }}>
        You don't have access to this tool.<br />
        Contact <a href="mailto:vincent@orah.com" style={{ color: 'var(--blue-500)', textDecoration: 'none' }}>vincent@orah.com</a> to request access.
      </p>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: 'var(--blue-500)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
        ← Back to home
      </Link>
    </div>
  )
}
