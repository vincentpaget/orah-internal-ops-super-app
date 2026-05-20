import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-prod';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function sign(header: object, payload: object): string {
  const data = `${base64url(Buffer.from(JSON.stringify(header)))}.${base64url(Buffer.from(JSON.stringify(payload)))}`;
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest();
  return `${data}.${base64url(sig)}`;
}

export function signJWT(payload: object): string {
  return sign({ alg: 'HS256', typ: 'JWT' }, { ...payload, iat: Math.floor(Date.now() / 1000) });
}

export function verifyJWT(token: string): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const data = `${parts[0]}.${parts[1]}`;
    const expected = base64url(crypto.createHmac('sha256', SECRET).update(data).digest());
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString()) as Record<string, unknown>;
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string): Record<string, string> {
  return Object.fromEntries(
    cookieHeader.split(';').map(s => s.trim().split('=')).filter(p => p.length === 2).map(([k, v]) => [k, decodeURIComponent(v)])
  );
}

const isSecure = process.env.VERCEL_ENV === 'production';
const cookieFlags = `HttpOnly; SameSite=Lax; Path=/${isSecure ? '; Secure' : ''}`;

export function sessionCookie(payload: object): string {
  const exp = Math.floor((Date.now() + SESSION_DURATION_MS) / 1000);
  const jwt = signJWT({ ...payload, exp });
  const maxAge = Math.floor(SESSION_DURATION_MS / 1000);
  return `session=${jwt}; Max-Age=${maxAge}; ${cookieFlags}`;
}

export function clearSessionCookie(): string {
  return `session=; Max-Age=0; ${cookieFlags}`;
}
