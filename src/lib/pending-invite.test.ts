import { describe, expect, it } from 'vitest'
import { isInviteToken, parsePendingInvite } from './pending-invite'

const TOKEN = 'a'.repeat(64)
const NOW = 1_800_000_000_000

describe('pending invite', () => {
  it('accepts only 64-character lowercase hex tokens', () => {
    expect(isInviteToken(TOKEN)).toBe(true)
    expect(isInviteToken('A'.repeat(64))).toBe(false)
    expect(isInviteToken('a'.repeat(63))).toBe(false)
    expect(isInviteToken(`../${'a'.repeat(61)}`)).toBe(false)
  })

  it('returns a fresh, well-formed token', () => {
    expect(parsePendingInvite(JSON.stringify({ token: TOKEN, at: NOW - 60_000 }), NOW)).toBe(TOKEN)
  })

  it('ignores missing, stale, malformed or tampered values', () => {
    expect(parsePendingInvite(null, NOW)).toBeNull()
    expect(parsePendingInvite('not json', NOW)).toBeNull()
    expect(parsePendingInvite(JSON.stringify({ token: TOKEN, at: NOW - 31 * 60_000 }), NOW)).toBeNull()
    expect(parsePendingInvite(JSON.stringify({ token: TOKEN, at: NOW + 60_000 }), NOW)).toBeNull()
    expect(parsePendingInvite(JSON.stringify({ token: '/evil', at: NOW }), NOW)).toBeNull()
    expect(parsePendingInvite(JSON.stringify({ token: TOKEN }), NOW)).toBeNull()
  })
})
