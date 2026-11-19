/**
 * Who is in the folder, who is looking at it right now (presence), and — for
 * the owner — invite links and member removal. The member list comes from the
 * folder page's live `team_members` query.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserLookup } from 'deepspace'
import type { PresencePeerClient, RecordData } from 'deepspace'
import { Link2, LogOut, RotateCcw, UserMinus } from 'lucide-react'
import { Button, cn, useToast } from '@/components/ui'
import { callAction, inviteLink } from '../../lib/api'
import type { FolderRole } from '../../schemas/drive-schemas'
import type { MemberRow } from '../../server/drive-access'
import { HereDot, PersonAvatar } from './visuals'

const ROLE_ORDER: Record<FolderRole, number> = { owner: 0, editor: 1, viewer: 2 }

export function MembersPanel({
  folderId,
  members,
  role,
  userId,
  peers,
}: {
  folderId: string
  members: RecordData<MemberRow>[]
  role: FolderRole | null
  userId: string
  peers: PresencePeerClient[]
}) {
  const { getName } = useUserLookup()
  const { success, error } = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const here = new Set(peers.map((p) => p.userId))
  here.add(userId)
  const isOwner = role === 'owner'
  const sorted = [...members].sort((a, b) => ROLE_ORDER[a.data.role] - ROLE_ORDER[b.data.role])

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key)
    try {
      await fn()
    } catch (err) {
      error('Something went wrong', (err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const copyInvite = (inviteRole: 'viewer' | 'editor') =>
    run(`invite-${inviteRole}`, async () => {
      const { token } = await callAction<{ token: string }>('createInvite', { folderId, role: inviteRole })
      const link = inviteLink(token)
      try {
        await navigator.clipboard.writeText(link)
        success(`${inviteRole === 'editor' ? 'Editor' : 'Viewer'} link copied`, 'Anyone with it can join after signing in.')
      } catch {
        window.prompt('Copy this invite link', link)
      }
    })

  return (
    <section
      aria-labelledby="people-heading"
      className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,18,23,0.04)] sm:p-[18px]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="people-heading" className="text-base font-semibold tracking-[-0.01em]">
          People
        </h2>
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-success">
          <HereDot />
          {members.filter((m) => here.has(m.data.userId)).length} here now
        </span>
      </div>

      <ul className="mt-2.5" data-testid="member-list">
        {sorted.map((m) => {
          const isMe = m.data.userId === userId
          const name = isMe ? 'You' : (getName(m.data.userId) ?? 'Member')
          const online = here.has(m.data.userId)
          return (
            <li key={m.recordId} className="flex min-h-12 items-center gap-2.5">
              <PersonAvatar userId={m.data.userId} name={isMe ? (getName(userId) ?? 'You') : name} here={online} />
              <span className="min-w-0 flex-1 truncate font-medium">
                {name}
                <span className="sr-only">{online ? ', here now' : ''}</span>
              </span>
              <span
                className={cn(
                  'inline-flex h-[22px] shrink-0 items-center rounded-full px-2 text-xs font-semibold capitalize',
                  m.data.role === 'owner' ? 'bg-foreground text-background' : 'border border-border text-[#3d4451]',
                )}
              >
                {m.data.role}
              </span>
              {isOwner && !isMe ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-[10px] text-muted-foreground hover:bg-[#fdecea] hover:text-destructive"
                  aria-label={`Remove ${name} from folder`}
                  disabled={busy !== null}
                  onClick={() => run(`rm-${m.data.userId}`, () => callAction('removeMember', { folderId, userId: m.data.userId }).then(() => {}))}
                >
                  <UserMinus className="size-4" />
                </Button>
              ) : (
                isOwner && <span className="w-10 shrink-0" aria-hidden />
              )}
            </li>
          )
        })}
      </ul>

      {isOwner ? (
        <div className="mt-3 border-t border-[#eef0f3] pt-3.5">
          <p className="text-sm font-semibold">Invite with a link</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Anyone with a link can join after signing in.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" className="rounded-[10px] bg-card text-[13px] font-semibold" disabled={busy !== null} onClick={() => copyInvite('editor')}>
              <Link2 /> Editor link
            </Button>
            <Button variant="outline" className="rounded-[10px] bg-card text-[13px] font-semibold" disabled={busy !== null} onClick={() => copyInvite('viewer')}>
              <Link2 /> Viewer link
            </Button>
          </div>
          <Button
            variant="ghost"
            className="mt-1.5 px-1 text-[13px] text-muted-foreground hover:bg-transparent hover:text-foreground"
            disabled={busy !== null}
            onClick={() =>
              run('reset', async () => {
                await callAction('resetInvites', { folderId })
                success('Links reset', 'Old invite links no longer work. Members stay.')
              })
            }
          >
            <RotateCcw /> Reset links
          </Button>
        </div>
      ) : (
        role && (
          <div className="mt-3 border-t border-[#eef0f3] pt-2">
            <Button
              variant="ghost"
              className="px-1 text-[13px] text-muted-foreground hover:bg-transparent hover:text-destructive"
              disabled={busy !== null}
              onClick={() =>
                run('leave', async () => {
                  await callAction('removeMember', { folderId, userId })
                  navigate('/drive')
                })
              }
            >
              <LogOut /> Leave folder
            </Button>
          </div>
        )
      )}
    </section>
  )
}
