import { NextRequest, NextResponse } from 'next/server';
import { sessionCookie, parseCookies } from '@/lib/session';

const SF_DOMAIN = process.env.SF_MY_DOMAIN || 'login.salesforce.com';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDesc = searchParams.get('error_description');

  if (error) {
    return new NextResponse(`Salesforce OAuth error: ${errorDesc || error}`, { status: 400 });
  }

  const cookies = parseCookies(req.headers.get('cookie') || '');
  if (!state || state !== cookies.oauth_state) {
    return new NextResponse('OAuth state mismatch. Please try logging in again.', { status: 400 });
  }

  const clientId = process.env.SF_OAUTH_CLIENT_ID;
  const clientSecret = process.env.SF_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.SF_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri || !code) {
    return new NextResponse('OAuth configuration error.', { status: 500 });
  }

  const tokenParams: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  };
  if (cookies.oauth_verifier) tokenParams.code_verifier = cookies.oauth_verifier;

  const tokenRes = await fetch(`https://${SF_DOMAIN}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(tokenParams),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return new NextResponse(`Token exchange failed: ${text.slice(0, 200)}`, { status: 502 });
  }

  const tokenData = await tokenRes.json() as { access_token?: string; id?: string };
  const { access_token, id: identityUrl } = tokenData;

  if (!access_token || !identityUrl) {
    return new NextResponse('Token response missing access_token or identity URL.', { status: 502 });
  }

  const idRes = await fetch(identityUrl, { headers: { 'Authorization': `Bearer ${access_token}` } });
  if (!idRes.ok) {
    const text = await idRes.text();
    return new NextResponse(`Identity fetch failed: ${text.slice(0, 200)}`, { status: 502 });
  }

  const { display_name, email, organization_id, user_id } = await idRes.json() as {
    display_name?: string; email?: string; organization_id?: string; user_id?: string;
  };

  const allowedOrg = process.env.SF_ORG_ID;
  if (allowedOrg && (!organization_id || !organization_id.startsWith(allowedOrg.slice(0, 15)))) {
    return new NextResponse('Access denied: your Salesforce org is not authorized.', { status: 403 });
  }

  const cookie = sessionCookie({ name: display_name || email, email, sub: user_id, org: organization_id });

  const res = NextResponse.redirect(new URL('/', req.nextUrl));
  res.headers.append('Set-Cookie', cookie);
  res.headers.append('Set-Cookie', 'oauth_state=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/');
  res.headers.append('Set-Cookie', 'oauth_verifier=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/');
  return res;
}
