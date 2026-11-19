import { describe, expect, it } from 'vitest'
import {
  aiSkipReason,
  canDeleteFile,
  canManageFolder,
  canUpload,
  fileBadge,
  fileIdFromKnowledgeName,
  initials,
  isIndexable,
  isOwnStorageKey,
  knowledgeFileName,
  knowledgeFolder,
  personalFolderId,
  pickIndex,
} from './drive'

describe('folder roles', () => {
  it('lets owners and editors upload, not viewers or strangers', () => {
    expect(canUpload('owner')).toBe(true)
    expect(canUpload('editor')).toBe(true)
    expect(canUpload('viewer')).toBe(false)
    expect(canUpload(null)).toBe(false)
  })

  it('only owners manage a folder', () => {
    expect(canManageFolder('owner')).toBe(true)
    expect(canManageFolder('editor')).toBe(false)
  })

  it('editors delete only their own files; owners delete any', () => {
    expect(canDeleteFile('editor', 'u1', 'u1')).toBe(true)
    expect(canDeleteFile('editor', 'u2', 'u1')).toBe(false)
    expect(canDeleteFile('owner', 'u2', 'u1')).toBe(true)
    expect(canDeleteFile('viewer', 'u1', 'u1')).toBe(false)
    expect(canDeleteFile(null, 'u1', 'u1')).toBe(false)
  })
})

describe('storage keys', () => {
  it('accepts a key in the caller\'s own private folder only', () => {
    expect(isOwnStorageKey('apps/app_1/users/u1/folders/x/a.txt', 'u1')).toBe(true)
    expect(isOwnStorageKey('apps/app_1/users/u2/folders/x/a.txt', 'u1')).toBe(false)
    expect(isOwnStorageKey('apps/app_1/users/u1x/a.txt', 'u1')).toBe(false)
    expect(isOwnStorageKey('apps/app_1/users/u1/../u2/a.txt', 'u1')).toBe(false)
  })
})

describe('knowledge naming', () => {
  it('maps a search hit back to its file id', () => {
    const name = knowledgeFileName('folder-1', 'file-abc', 'Q3 report (final).pdf')
    expect(name).toBe('file-abc__Q3_report__final_.pdf')
    expect(fileIdFromKnowledgeName(name)).toBe('file-abc')
    expect(fileIdFromKnowledgeName(`f/folder-1/${name}`)).toBe('file-abc')
    expect(fileIdFromKnowledgeName('no-separator.txt')).toBeNull()
  })

  it('keeps the whole item key within 128 characters and keeps the extension', () => {
    const folderId = personalFolderId('user_01JABCDEFGHJKMNPQRSTVWXYZ0')
    const fileId = crypto.randomUUID()
    const name = knowledgeFileName(folderId, fileId, `${'very long name '.repeat(20)}.docx`)
    expect(`${knowledgeFolder(folderId)}/${name}`.length).toBeLessThanOrEqual(128)
    expect(name.endsWith('.docx')).toBe(true)
  })

  it('indexes small documents but not media or large files', () => {
    expect(isIndexable('notes.md', 1000)).toBe(true)
    expect(isIndexable('paper.PDF', 1000)).toBe(true)
    expect(isIndexable('photo.jpg', 1000)).toBe(false)
    expect(isIndexable('big.pdf', 5 * 1024 * 1024)).toBe(false)
    expect(isIndexable('empty.txt', 0)).toBe(false)
  })

  it('says why a file was skipped', () => {
    expect(aiSkipReason('big.pdf', 7 * 1024 * 1024)).toBe('too_large')
    expect(aiSkipReason('photo.jpg', 1000)).toBe('unsupported')
    expect(aiSkipReason('huge-video.mp4', 7 * 1024 * 1024)).toBe('unsupported')
  })
})

describe('display helpers', () => {
  it('labels files by extension', () => {
    expect(fileBadge('flight.PDF')).toEqual({ kind: 'pdf', label: 'PDF' })
    expect(fileBadge('tram-28.jpg')).toEqual({ kind: 'image', label: 'JPG' })
    expect(fileBadge('costs.csv')).toEqual({ kind: 'sheet', label: 'CSV' })
    expect(fileBadge('README')).toEqual({ kind: 'other', label: 'FILE' })
    expect(fileBadge('.env')).toEqual({ kind: 'other', label: 'FILE' })
    expect(fileBadge('notes.markdown')).toEqual({ kind: 'text', label: 'FILE' })
  })

  it('makes initials from names and emails', () => {
    expect(initials('Maya Chen')).toBe('MC')
    expect(initials('Ana Maria Ribeiro')).toBe('AR')
    expect(initials('sam.ortiz@example.com')).toBe('SO')
    expect(initials('jo')).toBe('J')
    expect(initials('')).toBe('?')
  })

  it('picks the same colour slot for the same key', () => {
    expect(pickIndex('user_1', 6)).toBe(pickIndex('user_1', 6))
    for (const key of ['a', 'folder-xyz', 'user_01JABCDEFGHJKMNPQRSTVWXYZ0']) {
      const i = pickIndex(key, 6)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(6)
    }
  })
})
