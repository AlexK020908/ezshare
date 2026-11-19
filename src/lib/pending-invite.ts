/**
 * Remembers an invite while the visitor signs in.
 *
 * Signing in with Google or GitHub leaves the site, and the platform brings
 * the user back to the app rather than to the invite page. So when a
 * signed-out visitor clicks "Sign in to join", the invite token is kept in
 * sessionStorage (this browser tab only, for 30 minutes) and the signed-in
 * area picks it up again (see `(protected)/_layout.tsx`).
 *
 * Only a well-formed token is ever stored or returned, because it ends up in
 * a URL path. The server still checks it like any other invite.
 */

const KEY = 'ezshare:pending-invite'
const MAX_AGE_MS = 30 * 60 * 1000

export function isInviteToken(token: string): boolean {
  return /^[a-f0-9]{64}$/.test(token)
}

/** Pure: the token in a stored value, or null if it's missing, malformed or too old. */
export function parsePendingInvite(raw: string | null, now: number): string | null {
  if (!raw) return null
  try {
    const { token, at } = JSON.parse(raw) as { token?: unknown; at?: unknown }
    if (typeof token !== 'string' || !isInviteToken(token)) return null
    if (typeof at !== 'number' || now - at < 0 || now - at > MAX_AGE_MS) return null
    return token
  } catch {
    return null
  }
}

export function rememberInvite(token: string): void {
  if (!isInviteToken(token)) return
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ token, at: Date.now() }))
  } catch {
    // Storage blocked (private mode etc.): the invite link still works if reopened after signing in.
  }
}

/** Returns the remembered invite (if any) and forgets it, so it's used once. */
export function takePendingInvite(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return parsePendingInvite(raw, Date.now())
  } catch {
    return null
  }
}

export function forgetPendingInvite(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing stored, nothing to forget.
  }
}
