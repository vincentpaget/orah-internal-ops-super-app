import { NextRequest, NextResponse } from 'next/server'

// Per-tool allowlist env var names
const TOOL_ALLOW_ENV: Record<string, string> = {
  '/pipeline':       'PIPELINE_ALLOW',
  '/dedupe':         'DEDUPE_ALLOW',
  '/event-leads':    'EVENT_LEADS_ALLOW',
  '/campaign-setup': 'CAMPAIGN_SETUP_ALLOW',
}

// Decode JWT payload without verifying the signature.
// The signature check still happens in app/(app)/layout.tsx (server component),
// so a forged token here won't grant access — it'll be rejected downstream.
// We only need the email to decide which page to send the user to.
function emailFromToken(token: string): string | null {
  try {
    const b64url = token.split('.')[1]
    if (!b64url) return null
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice((b64url.length % 4) || 4)
    const payload = JSON.parse(atob(b64)) as Record<string, unknown>
    return typeof payload.email === 'string' ? payload.email : null
  } catch {
    return null
  }
}

function getAllowList(envKey: string): string[] {
  return (process.env[envKey] ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const envKey = Object.keys(TOOL_ALLOW_ENV).find(prefix => pathname.startsWith(prefix))
  if (!envKey) return NextResponse.next()

  const allowed = getAllowList(TOOL_ALLOW_ENV[envKey])
  // Empty allowlist → no restriction
  if (allowed.length === 0) return NextResponse.next()

  const token = req.cookies.get('session')?.value ?? ''
  const email = emailFromToken(token)

  // No session → let the auth gate in app/(app)/layout.tsx redirect to /login
  if (!email) return NextResponse.next()

  if (!allowed.includes(email.toLowerCase())) {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/pipeline/:path*', '/dedupe/:path*', '/event-leads/:path*', '/campaign-setup/:path*'],
}
