/**
 * Two-pane drive shell: the folder list on the left, the open folder on the
 * right. The folder list is a live query — RBAC ('team' read) returns only
 * folders the signed-in user belongs to. On phones the list becomes a row of
 * chips you scroll sideways.
 */

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { HardDrive, Loader2, Plus } from 'lucide-react'
import { Button, Input, Label, Modal, cn, useToast } from '@/components/ui'
import { callAction } from '../../lib/api'
import type { FolderRow } from '../../server/drive-access'
import { FolderTile } from './visuals'

export function DriveLayout({ activeFolderId, children }: { activeFolderId?: string; children: ReactNode }) {
  const { records: folders, status } = useQuery<FolderRow>('folders', { orderBy: 'createdAt' })
  const [personalId, setPersonalId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const { error } = useToast()

  // Make sure the personal drop exists, whichever page the user lands on.
  useEffect(() => {
    let cancelled = false
    callAction<{ folderId: string }>('ensurePersonalFolder')
      .then((res) => !cancelled && setPersonalId(res.folderId))
      .catch((err: Error) => error('Could not open your drop', err.message))
    return () => {
      cancelled = true
    }
  }, [error])

  const shared = folders.filter((f) => f.data.kind === 'shared')
  const dropActive = !!personalId && activeFolderId === personalId

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <aside className="shrink-0 border-b border-border bg-card md:w-60 md:border-b-0 md:border-r">
        <nav
          aria-label="Folders"
          className="flex gap-2 overflow-x-auto px-4 pb-3 pt-2.5 md:flex-col md:gap-0.5 md:overflow-visible md:px-3 md:py-5"
        >
          <FolderLink
            to={personalId ? `/f/${personalId}` : '/drive'}
            active={dropActive}
            icon={
              <span
                aria-hidden
                className={cn(
                  'flex size-[26px] shrink-0 items-center justify-center rounded-[7px] max-md:size-6 max-md:rounded-full',
                  dropActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-[#4a5260]',
                )}
              >
                <HardDrive className="size-[15px] max-md:size-[13px]" />
              </span>
            }
            label="My drop"
          />

          <div className="hidden items-center justify-between pb-1.5 pl-2.5 pr-1 pt-5 md:flex">
            <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">Shared folders</p>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-[#3d4451]"
              aria-label="New shared folder"
              onClick={() => setCreating(true)}
            >
              <Plus className="size-[17px]" />
            </Button>
          </div>
          {status === 'loading' && (
            <span className="hidden px-2.5 py-1.5 text-sm text-muted-foreground md:block">Loading…</span>
          )}
          {shared.map((f) => (
            <FolderLink
              key={f.recordId}
              to={`/f/${f.recordId}`}
              active={activeFolderId === f.recordId}
              icon={<FolderTile folderId={f.recordId} name={f.data.name} active={activeFolderId === f.recordId} />}
              label={f.data.name}
            />
          ))}
          {status === 'ready' && shared.length === 0 && (
            <p className="hidden px-2.5 py-1.5 text-sm text-muted-foreground md:block">
              None yet. Make one to share files with people.
            </p>
          )}
          {/* Phones: the "+" lives at the end of the chip row instead. */}
          <button
            type="button"
            aria-label="New shared folder"
            onClick={() => setCreating(true)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-input px-3.5 text-sm font-medium text-[#3d4451] md:hidden"
          >
            <Plus className="size-4" aria-hidden /> New
          </button>
        </nav>
      </aside>
      <section className="min-h-0 flex-1 overflow-y-auto">{children}</section>
      <NewFolderDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

function FolderLink({ to, active, icon, label }: { to: string; active: boolean; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-10 shrink-0 items-center gap-2.5 text-sm transition-colors',
        // Phones: a pill-shaped chip. Larger screens: a full-width row.
        'rounded-full border pl-2 pr-3.5 md:rounded-[10px] md:border-0 md:px-2.5',
        active
          ? 'border-[#c9d6ff] bg-accent font-semibold text-accent-foreground'
          : 'border-border font-medium text-[#3d4451] hover:bg-muted hover:text-foreground',
      )}
    >
      {icon}
      <span className="max-w-[11rem] truncate">{label}</span>
    </Link>
  )
}

function NewFolderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const { error } = useToast()

  function close() {
    setName('')
    onClose()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      const { folderId } = await callAction<{ folderId: string }>('createFolder', { name: name.trim() })
      close()
      navigate(`/f/${folderId}`)
    } catch (err) {
      error('Could not create the folder', (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={close} size="sm">
      <form onSubmit={submit}>
        <Modal.Header>
          <Modal.Title>New shared folder</Modal.Title>
          <Modal.Description>You'll be its owner. Invite people from the folder's People panel.</Modal.Description>
        </Modal.Header>
        <Modal.Body className="space-y-2">
          <Label htmlFor="new-folder-name">Folder name</Label>
          <Input
            id="new-folder-name"
            autoFocus
            placeholder="e.g. Trip to Lisbon"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : 'Create'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
