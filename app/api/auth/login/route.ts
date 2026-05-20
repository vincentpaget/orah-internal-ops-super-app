import crypto from 'crypto';
import { NextResponse } from 'next/server';

const SF_DOMAIN = process.env.SF_MY_DOMAIN || 'login.salesforce.com';

function base64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function GET(): NextResponse {
  const clientId = process.env.SF_OAUTH_CLIENT_ID;
  const redirectUri = process.env.SF_OAUTH_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return new NextResponse('SF_OAUTH_CLIENT_ID and SF_OAUTH_REDIRECT_URI must be configured.', { status: 500 });
  }

  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = base64urlEncode(crypto.randomBytes(32));
  const codeChallenge = base64urlEncode(crypto.createHash('sha256').update(codeVerifier).digest());

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'id openid',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const res = NextResponse.redirect(`https://${SF_DOMAIN}/services/oauth2/authorize?${params}`);
  res.cookies.set('oauth_state', state, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600 });
  res.cookies.set('oauth_verifier', codeVerifier, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
