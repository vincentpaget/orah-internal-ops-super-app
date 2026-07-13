'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SUBNAV = [
  { href: '/pricing-migration', label: 'Renewal Migration', exact: true },
  { href: '/pricing-migration/accounts', label: 'Accounts' },
  { href: '/pricing-migration/renewals-closing-soon', label: 'Renewals Closing Soon' },
  { href: '/pricing-migration/pricing', label: 'Pricing Model' },
  { href: '/pricing-migration/rules', label: 'Migration Rules' },
];

export default function PricingMigrationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    // Negative margins escape AppShell's padding: '32px 40px 64px'
    <div style={{ margin: '-32px -40px -64px', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 56px)' }}>
      <nav style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: '0 32px',
        flexShrink: 0,
      }}>
        {SUBNAV.map(({ href, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={{
                padding: '11px 14px',
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--navy-900)' : 'var(--fg-2)',
                textDecoration: 'none',
                borderBottom: `2px solid ${active ? 'var(--navy-900)' : 'transparent'}`,
                whiteSpace: 'nowrap',
                transition: 'color 120ms',
                marginBottom: -1,
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div style={{ flex: 1, background: 'var(--bg-subtle)', overflowX: 'auto' }}>
        {children}
      </div>
    </div>
  );
}
