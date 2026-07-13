import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session';

export function GET(req: NextRequest): NextResponse {
  const res = NextResponse.redirect(new URL('/login', req.nextUrl));
  res.headers.set('Set-Cookie', clearSessionCookie());
  res.headers.append('Set-Cookie', 'sf_session=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/');
  return res;
}
