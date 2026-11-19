/**
 * ezshare data model.
 *
 * A *folder* is the unit of sharing. Every folder is also a DeepSpace "team":
 * its `teamId` is its own record id, and the `team_members` collection lists
 * who is in it. The built-in `'team'` read rule then hides a folder, its files
 * and its member list from everyone who is not in that team — enforced by the
 * RecordRoom on the server, and applied to live subscriptions too.
 *
 * A person's cross-device "drop" is just a folder of kind `personal` whose
 * only member is its owner, so personal and shared files share one code path.
 *
 * Every write goes through a server action (src/actions/index.ts), because
 * each one depends on the caller's role *inside a folder*, which a per-
 * collection `create: true` cannot express (anyone could add a file record to
 * any folder id). Clients therefore get read-only access here.
 */

import type { CollectionSchema, RolePermissions } from 'deepspace/schema'

const NONE: RolePermissions = { read: false, create: false, update: false, delete: false }
/** Signed-in roles may read rows of folders they belong to; nothing else. */
const TEAM_READ_ONLY: RolePermissions = { read: 'team', create: false, update: false, delete: false }

/** App-level roles. Admins get no extra reach: the app owner cannot browse users' files. */
function teamReadOnly(): Record<string, RolePermissions> {
  return { '*': NONE, viewer: TEAM_READ_ONLY, member: TEAM_READ_ONLY, admin: TEAM_READ_ONLY }
}

export const FOLDER_ROLES = ['owner', 'editor', 'viewer'] as const
export type FolderRole = (typeof FOLDER_ROLES)[number]

export const foldersSchema: CollectionSchema = {
  name: 'folders',
  columns: [
    { name: 'teamId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'name', storage: 'text', interpretation: 'plain', required: true, maxLength: 80 },
    {
      name: 'kind',
      storage: 'text',
      interpretation: { kind: 'select', options: ['personal', 'shared'] },
      required: true,
      immutable: true,
    },
  ],
  teamField: 'teamId',
  permissions: teamReadOnly(),
}

/**
 * Folder membership. The name and the `teamId`/`userId`/`status` columns are
 * the contract the `'team'` permission rule resolves against.
 */
export const teamMembersSchema: CollectionSchema = {
  name: 'team_members',
  columns: [
    { name: 'teamId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    {
      name: 'role',
      storage: 'text',
      interpretation: { kind: 'select', options: [...FOLDER_ROLES] },
      required: true,
    },
    { name: 'status', storage: 'text', interpretation: 'plain' },
  ],
  uniqueOn: ['teamId', 'userId'],
  teamField: 'teamId',
  permissions: teamReadOnly(),
}

/**
 * File metadata (the design's FileMetadata table). The bytes live in the
 * uploader's private R2 folder at `storageKey`; nobody but the uploader can
 * fetch that key directly, so other members download through the worker's
 * membership-checked route instead.
 */
export const filesSchema: CollectionSchema = {
  name: 'files',
  columns: [
    { name: 'folderId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'name', storage: 'text', interpretation: 'plain', required: true, maxLength: 255 },
    { name: 'size', storage: 'number', interpretation: 'plain', required: true },
    { name: 'mimeType', storage: 'text', interpretation: 'plain', maxLength: 255 },
    { name: 'storageKey', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'uploaderId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    /** SHA-256 of the content, computed by the uploading client, for duplicate detection. */
    { name: 'fingerprint', storage: 'text', interpretation: 'plain', maxLength: 64 },
    {
      name: 'aiStatus',
      storage: 'text',
      interpretation: { kind: 'select', options: ['indexing', 'ready', 'skipped', 'error'] },
    },
    /** Knowledge-base item ids for this file (JSON array), so delete can remove them. */
    { name: 'aiItemIds', storage: 'text', interpretation: { kind: 'json' } },
  ],
  teamField: 'folderId',
  permissions: teamReadOnly(),
}

/**
 * Per-user daily count of "ask this folder" questions (answers are paid from
 * the app owner's credits). Server-only: no role can read or write it.
 */
export const askUsageSchema: CollectionSchema = {
  name: 'ask_usage',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'day', storage: 'text', interpretation: 'plain', required: true },
    { name: 'count', storage: 'number', interpretation: 'plain', required: true },
  ],
  uniqueOn: ['userId', 'day'],
  permissions: { '*': NONE, viewer: NONE, member: NONE, admin: NONE },
}

/**
 * Invite links. Readable only by the person who created them: an invite token
 * grants a role, so a viewer must never see the editor link's token.
 */
export const invitesSchema: CollectionSchema = {
  name: 'invites',
  columns: [
    { name: 'teamId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'token', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    {
      name: 'role',
      storage: 'text',
      interpretation: { kind: 'select', options: ['editor', 'viewer'] },
      required: true,
      immutable: true,
    },
    { name: 'revoked', storage: 'number', interpretation: { kind: 'boolean' } },
  ],
  uniqueOn: ['token'],
  permissions: {
    '*': NONE,
    viewer: { read: 'own', create: false, update: false, delete: false },
    member: { read: 'own', create: false, update: false, delete: false },
    admin: { read: 'own', create: false, update: false, delete: false },
  },
}
