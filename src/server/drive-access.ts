/**
 * Membership lookups for actions and routes.
 *
 * Actions and the download route reach records with RBAC switched off (see
 * the trust model in action-routes.ts), so every one of them must call
 * `requireRole` before touching a folder's data. This file is that one check.
 */

import type { ActionTools } from 'deepspace/worker'
import type { FolderRole } from '../schemas/drive-schemas'

export interface FolderRow {
  teamId: string
  name: string
  kind: 'personal' | 'shared'
}

export interface MemberRow {
  teamId: string
  userId: string
  role: FolderRole
  status: string | null
}

export interface FileRow {
  folderId: string
  name: string
  size: number
  mimeType: string
  storageKey: string
  uploaderId: string
  fingerprint: string
  aiStatus: 'indexing' | 'ready' | 'skipped' | 'error'
  aiItemIds: string[] | string | null
}

export class AccessError extends Error {
  constructor(
    readonly code: 'not_found' | 'forbidden' | 'invalid',
    message: string,
  ) {
    super(message)
  }
}

/** The caller's role in a folder, or null when they are not an active member. */
export async function folderRole(
  tools: ActionTools,
  folderId: string,
  userId: string,
): Promise<{ role: FolderRole; memberId: string } | null> {
  const res = await tools.query<Record<string, unknown>>('team_members', {
    where: { teamId: folderId, userId },
    limit: 1,
  })
  if (!res.success) throw new Error(`membership lookup failed: ${res.error}`)
  const row = res.data.records[0]
  if (!row) return null
  const data = row.data as unknown as MemberRow
  if (data.status && data.status !== 'active') return null
  return { role: data.role, memberId: row.recordId }
}

/**
 * Throws unless the caller is a member whose role passes `allowed`.
 * Non-members get `not_found`, not `forbidden`, so a stranger cannot probe
 * which folder ids exist.
 */
export async function requireRole(
  tools: ActionTools,
  folderId: string,
  userId: string,
  allowed: (role: FolderRole) => boolean,
): Promise<FolderRole> {
  const membership = await folderRole(tools, folderId, userId)
  if (!membership) throw new AccessError('not_found', 'Folder not found')
  if (!allowed(membership.role)) throw new AccessError('forbidden', 'Your role in this folder does not allow that')
  return membership.role
}

export async function getFile(
  tools: ActionTools,
  fileId: string,
): Promise<{ id: string; data: FileRow } | null> {
  const res = await tools.get<Record<string, unknown>>('files', fileId)
  if (!res.success || !res.data?.record) return null
  return { id: res.data.record.recordId, data: res.data.record.data as unknown as FileRow }
}

export function parseItemIds(value: FileRow['aiItemIds']): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  if (typeof value === 'string' && value) {
    try {
      const parsed: unknown = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
    } catch {
      return []
    }
  }
  return []
}
