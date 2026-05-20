import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session';

export function GET(req: NextRequest): NextResponse {
  const res = NextResponse.redirect(new URL('/login', req.nextUrl));
  res.headers.set('Set-Cookie', clearSessionCookie());
  return res;
}
