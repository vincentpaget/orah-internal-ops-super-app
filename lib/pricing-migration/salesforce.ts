import { Connection, OAuth2 } from 'jsforce';
import { cookies } from 'next/headers';

export async function getConnectionFromCookie(): Promise<Connection | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get('sf_session')?.value;
  if (!raw) return null;
  try {
    const session = JSON.parse(decodeURIComponent(raw)) as {
      accessToken?: string;
      instanceUrl?: string;
      refreshToken?: string;
    };
    if (!session.accessToken || !session.instanceUrl) return null;
    return new Connection({
      oauth2: new OAuth2({
        loginUrl: `https://${process.env.SF_MY_DOMAIN ?? 'login.salesforce.com'}`,
        clientId: process.env.SF_OAUTH_CLIENT_ID ?? '',
        clientSecret: process.env.SF_OAUTH_CLIENT_SECRET ?? '',
        redirectUri: process.env.SF_OAUTH_REDIRECT_URI ?? '',
      }),
      accessToken: session.accessToken,
      instanceUrl: session.instanceUrl,
      ...(session.refreshToken ? { refreshToken: session.refreshToken } : {}),
    });
  } catch {
    return null;
  }
}
