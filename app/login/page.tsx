export default function LoginPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--navy-900)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: '48px 56px',
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        minWidth: 340,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-orah-symbol.svg" alt="Orah" style={{ height: 36, display: 'block', margin: '0 auto 16px' }} />
        <div style={{ fontSize: 22, fontWeight: 700, color: '#002744', marginBottom: 6 }}>
          Orah Internal Ops Hub
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 36 }}>
          Orah · internal tools
        </div>
        <a
          href="/api/auth/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: '#009EDB',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '12px 28px',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          Sign in with Salesforce
        </a>
      </div>
    </div>
  )
}
