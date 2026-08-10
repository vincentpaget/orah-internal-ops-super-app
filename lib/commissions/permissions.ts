export interface CommissionsPermissions {
  /** Full read/write access to every rep's data. */
  isAdmin: boolean
  /** The logged-in user's own Salesforce User Id (from the OAuth session), or null if unknown. */
  ownerId: string | null
  /** Display name for the logged-in user, for use as their own "rep" label. */
  ownerName: string | null
}

function getAdminAllowlist(): string[] {
  return (process.env.COMMISSIONS_ADMIN_ALLOW ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

/** `session` is whatever `verifyJWT()` returned — untyped by design, matching the rest of the app. */
export function getCommissionsPermissions(session: Record<string, unknown> | null): CommissionsPermissions {
  const email = (session?.email as string | undefined)?.toLowerCase() ?? ''
  const isAdmin = getAdminAllowlist().includes(email)
  return {
    isAdmin,
    ownerId: (session?.sub as string | undefined) ?? null,
    ownerName: (session?.name as string | undefined) ?? (session?.email as string | undefined) ?? null,
  }
}
