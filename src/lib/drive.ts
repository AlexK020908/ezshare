/**
 * Pure rules shared by the worker, the browser and the unit tests.
 * No DeepSpace imports here, so it runs anywhere and is easy to test.
 */

import type { FolderRole } from '../schemas/drive-schemas'

/** Per-file cap. The free plan gives the whole app 128 MiB, so keep files small. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024

/** The knowledge base accepts non-text parts up to 4 MiB; larger files are not indexed. */
export const MAX_INDEX_BYTES = 4 * 1024 * 1024

/** The AI Search item key (folder + "/" + filename) is capped at 128 characters. */
const KNOWLEDGE_KEY_LIMIT = 128

export function canUpload(role: FolderRole | null): boolean {
  return role === 'owner' || role === 'editor'
}

export function canManageFolder(role: FolderRole | null): boolean {
  return role === 'owner'
}

/** The uploader may delete their own file; the folder owner may delete any file. */
export function canDeleteFile(role: FolderRole | null, uploaderId: string, userId: string): boolean {
  if (role === null) return false
  return role === 'owner' || (role === 'editor' && uploaderId === userId)
}

/** Each user's personal drop has a fixed id, so creating it twice is harmless. */
export function personalFolderId(userId: string): string {
  return `me-${userId.replace(/[^A-Za-z0-9_-]/g, '_')}`
}

/**
 * A storage key returned by `useR2Files().upload` (scope `self`) lives under
 * `.../users/<userId>/...`. Refusing any other key stops a client from
 * registering someone else's private file as its own upload.
 */
export function isOwnStorageKey(storageKey: string, userId: string): boolean {
  return (
    storageKey.includes(`/users/${userId}/`) &&
    !storageKey.includes('..') &&
    !storageKey.includes('\\')
  )
}

/** One knowledge-base folder per ezshare folder; search is limited to it. */
export function knowledgeFolder(folderId: string): string {
  return `f/${folderId}`
}

/**
 * Knowledge item filename: `<fileId>__<safe name>`. The file id prefix maps a
 * search hit back to its file record; the original extension is kept because
 * the indexer picks its parser from it.
 */
export function knowledgeFileName(folderId: string, fileId: string, name: string): string {
  const budget = KNOWLEDGE_KEY_LIMIT - (knowledgeFolder(folderId).length + 1) - (fileId.length + 2)
  const safe = name.replace(/[^A-Za-z0-9._-]/g, '_')
  const dot = safe.lastIndexOf('.')
  const ext = dot > 0 ? safe.slice(dot).slice(0, 10) : ''
  const stem = dot > 0 ? safe.slice(0, dot) : safe
  const room = Math.max(1, budget - ext.length)
  return `${fileId}__${stem.slice(0, room) || 'file'}${ext}`
}

export function fileIdFromKnowledgeName(filename: string | undefined): string | null {
  if (!filename) return null
  const base = filename.split('/').pop() ?? filename
  const at = base.indexOf('__')
  return at > 0 ? base.slice(0, at) : null
}

const INDEXABLE_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'json', 'pdf', 'docx', 'xlsx', 'log', 'yaml', 'yml',
  'xml', 'tsv', 'rtf', 'py', 'js', 'ts', 'tsx', 'java', 'c', 'cpp', 'go', 'rs', 'sql',
])

/** Whether "ask this folder" can read this file. */
export function isIndexable(name: string, size: number): boolean {
  if (size <= 0 || size > MAX_INDEX_BYTES) return false
  const ext = name.toLowerCase().split('.').pop() ?? ''
  return INDEXABLE_EXTENSIONS.has(ext)
}

/** Why "ask this folder" skipped a file, so the UI can say so. */
export function aiSkipReason(name: string, size: number): 'too_large' | 'unsupported' {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  return INDEXABLE_EXTENSIONS.has(ext) && size > MAX_INDEX_BYTES ? 'too_large' : 'unsupported'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

// ---------------------------------------------------------------------------
// Display helpers (pure, so they're unit-tested with the rules above)
// ---------------------------------------------------------------------------

export type FileKind = 'pdf' | 'image' | 'doc' | 'sheet' | 'text' | 'code' | 'media' | 'archive' | 'other'

const KIND_BY_EXTENSION: Record<string, FileKind> = {
  pdf: 'pdf',
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', heic: 'image', svg: 'image', avif: 'image',
  doc: 'doc', docx: 'doc', rtf: 'doc', odt: 'doc', pages: 'doc', ppt: 'doc', pptx: 'doc', key: 'doc',
  xls: 'sheet', xlsx: 'sheet', csv: 'sheet', tsv: 'sheet', ods: 'sheet', numbers: 'sheet',
  txt: 'text', md: 'text', markdown: 'text', log: 'text',
  json: 'code', yaml: 'code', yml: 'code', xml: 'code', html: 'code', css: 'code', js: 'code', ts: 'code',
  tsx: 'code', py: 'code', java: 'code', c: 'code', cpp: 'code', go: 'code', rs: 'code', sql: 'code', sh: 'code',
  mp3: 'media', wav: 'media', m4a: 'media', mp4: 'media', mov: 'media', webm: 'media',
  zip: 'archive', gz: 'archive', tar: 'archive', '7z': 'archive', rar: 'archive',
}

/** The file-type tile shown next to a file: a colour family and a short label ("PDF", "JPG"). */
export function fileBadge(name: string): { kind: FileKind; label: string } {
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  const kind = KIND_BY_EXTENSION[ext] ?? 'other'
  const label = ext && ext.length <= 4 ? ext.toUpperCase() : 'FILE'
  return { kind, label }
}

/** Up to two initials for an avatar: "Maya Chen" → "MC", "maya@x.com" → "M". */
export function initials(name: string): string {
  const words = name.replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean)
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0]?.[0] ?? '?')
  return letters.toUpperCase()
}

/** A stable index in [0, n) for a string, so a person or folder keeps its colour everywhere. */
export function pickIndex(key: string, n: number): number {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return Math.abs(hash) % n
}
