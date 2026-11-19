/**
 * Browser helpers for talking to the worker.
 */

import { getAuthToken } from 'deepspace'

export class ActionError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
  }
}

/** Call a server action from src/actions/index.ts and return its `data`. */
export async function callAction<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new ActionError('You are signed out. Sign in and try again.', 'unauthorized')
  const res = await fetch(`/api/actions/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  })
  let body: { success?: boolean; data?: T; error?: string; code?: string } = {}
  try {
    body = await res.json()
  } catch {
    // Non-JSON error page; fall through to the generic message.
  }
  if (!res.ok || !body.success) {
    throw new ActionError(body.error ?? `Request failed (${res.status})`, body.code)
  }
  return body.data as T
}

/**
 * The membership-checked download route (src/server/drive-routes.ts). A plain
 * link works: the browser sends the app's session cookie on same-origin GETs.
 */
export function downloadUrl(fileId: string): string {
  return `/api/drive/files/${encodeURIComponent(fileId)}/download`
}

/** SHA-256 of a file's bytes as hex — the design's content fingerprint. */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function inviteLink(token: string): string {
  return `${window.location.origin}/join/${token}`
}
