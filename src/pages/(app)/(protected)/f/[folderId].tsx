/**
 * /f/:folderId — one folder: upload, the live file list, members, and Ask.
 *
 * Wide screens (xl): files on the left, "Ask this folder" and "People" stacked
 * on the right. Narrower: everything in one column, with a switch between Ask
 * and People. Each panel is rendered once and only hidden by CSS, so the Ask
 * panel's indexing poll never runs twice.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuthUser, usePresenceRoom, useQuery, useUserLookup } from 'deepspace'
import type { PresencePeerClient, RecordData } from 'deepspace'
import { FolderX, HardDrive, Trash2, Users } from 'lucide-react'
import { Button, ConfirmModal, cn, useToast } from '@/components/ui'
import { DriveLayout } from '../../../../components/drive/DriveLayout'
import { UploadZone } from '../../../../components/drive/UploadZone'
import { FileList } from '../../../../components/drive/FileList'
import { MembersPanel } from '../../../../components/drive/MembersPanel'
import { AskPanel } from '../../../../components/drive/AskPanel'
import { HereDot, PersonAvatar } from '../../../../components/drive/visuals'
import { callAction } from '../../../../lib/api'
import { aiSkipReason, canManageFolder, canUpload, formatBytes } from '../../../../lib/drive'
import type { FolderRole } from '../../../../schemas/drive-schemas'
import type { FileRow, FolderRow, MemberRow } from '../../../../server/drive-access'

export default function FolderPage() {
  const { folderId = '' } = useParams()
  return (
    <DriveLayout activeFolderId={folderId}>
      <FolderView key={folderId} folderId={folderId} />
    </DriveLayout>
  )
}

/**
 * Presence rooms are not membership-checked by the platform, so only shared
 * folders join one (their ids are random and only members learn them). A
 * personal drop's id derives from the user id, which other users can see.
 */
function SharedPresence({ folderId, children }: { folderId: string; children: (peers: PresencePeerClient[]) => ReactNode }) {
  const { peers } = usePresenceRoom(`folder:${folderId}`)
  return <>{children(peers)}</>
}

function FolderView({ folderId }: { folderId: string }) {
  const folders = useQuery<FolderRow>('folders', { where: { teamId: folderId }, limit: 1 })
  const folder = folders.records[0]

  if (folders.status === 'loading') return <p className="p-6 text-sm text-muted-foreground">Loading…</p>
  if (!folder) {
    // RBAC hides folders you are not in, so "missing" and "not yours" look the same.
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-[#3d4451]">
          <FolderX className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-[-0.02em]">Folder not found</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          It may have been deleted, or you are not a member. Ask its owner for an invite link.
        </p>
        <Link
          to="/drive"
          className="mt-5 inline-flex h-10 items-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Go to my drop
        </Link>
      </div>
    )
  }
  if (folder.data.kind === 'personal') return <FolderBody folderId={folderId} folder={folder.data} peers={[]} />
  return (
    <SharedPresence folderId={folderId}>
      {(peers) => <FolderBody folderId={folderId} folder={folder.data} peers={peers} />}
    </SharedPresence>
  )
}

function FolderBody({ folderId, folder, peers }: { folderId: string; folder: FolderRow; peers: PresencePeerClient[] }) {
  const { user } = useAuthUser()
  const userId = user?.id ?? ''
  const members = useQuery<MemberRow>('team_members', { where: { teamId: folderId } })
  const files = useQuery<FileRow>('files', { where: { folderId }, orderBy: 'createdAt', orderDir: 'desc' })
  const [panel, setPanel] = useState<'ask' | 'people'>('ask')

  const role = members.records.find((m) => m.data.userId === userId)?.data.role ?? null
  const fingerprints = useMemo(
    () => new Set(files.records.map((f) => f.data.fingerprint).filter(Boolean)),
    [files.records],
  )
  const indexingCount = files.records.filter((f) => f.data.aiStatus === 'indexing').length
  const readyCount = files.records.filter((f) => f.data.aiStatus === 'ready').length
  const tooLargeCount = files.records.filter(
    (f) => f.data.aiStatus === 'skipped' && aiSkipReason(f.data.name, f.data.size) === 'too_large',
  ).length

  if (members.status === 'loading') return <p className="p-6 text-sm text-muted-foreground">Loading…</p>

  const personal = folder.kind === 'personal'

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-5 md:px-8 md:py-7">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-4">
          <FolderHeader
            folderId={folderId}
            folder={folder}
            files={files.records}
            members={members.records}
            peers={peers}
            role={role}
            userId={userId}
          />
          <UploadZone folderId={folderId} fingerprints={fingerprints} canUpload={canUpload(role)} personal={personal} />
          {files.status === 'loading' ? (
            <p className="text-sm text-muted-foreground">Loading files…</p>
          ) : (
            <FileList files={files.records} role={role} userId={userId} personal={personal} />
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          {!personal && (
            <div role="tablist" aria-label="Folder panels" className="grid grid-cols-2 gap-1 rounded-xl bg-[#ebedf1] p-1 xl:hidden">
              <PanelTab selected={panel === 'ask'} onSelect={() => setPanel('ask')}>
                Ask this folder
              </PanelTab>
              <PanelTab selected={panel === 'people'} onSelect={() => setPanel('people')}>
                People · {members.records.length}
              </PanelTab>
            </div>
          )}
          <div className={cn(!personal && panel !== 'ask' && 'hidden xl:block')}>
            <AskPanel folderId={folderId} indexingCount={indexingCount} readyCount={readyCount} tooLargeCount={tooLargeCount} />
          </div>
          {!personal && (
            <div className={cn(panel !== 'people' && 'hidden xl:block')}>
              <MembersPanel folderId={folderId} members={members.records} role={role} userId={userId} peers={peers} />
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function FolderHeader({
  folderId,
  folder,
  files,
  members,
  peers,
  role,
  userId,
}: {
  folderId: string
  folder: FolderRow
  files: RecordData<FileRow>[]
  members: RecordData<MemberRow>[]
  peers: PresencePeerClient[]
  role: FolderRole | null
  userId: string
}) {
  const { getName } = useUserLookup()
  const personal = folder.kind === 'personal'
  const totalBytes = files.reduce((sum, f) => sum + (f.data.size ?? 0), 0)
  const here = new Set(peers.map((p) => p.userId).filter((id) => id !== userId))
  const othersHere = members.filter((m) => here.has(m.data.userId))
  const firstName = (id: string) => (getName(id) ?? 'Someone').split(' ')[0]

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pb-1">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
          {personal ? <HardDrive className="size-[15px]" aria-hidden /> : <Users className="size-[15px]" aria-hidden />}
          {personal ? 'Your private drop' : 'Shared folder'}
        </p>
        <h1
          className="mt-1.5 truncate text-[26px] font-bold leading-tight tracking-[-0.025em] md:text-[30px]"
          data-testid="folder-title"
        >
          {folder.name}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>
            {files.length} file{files.length === 1 ? '' : 's'}
          </span>
          <span aria-hidden>·</span>
          <span>{formatBytes(totalBytes)}</span>
          <span aria-hidden>·</span>
          {personal ? (
            <span>Only you can see this</span>
          ) : othersHere.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-success">
              <HereDot />
              {othersHere.length === 1
                ? `${firstName(othersHere[0].data.userId)} is here now`
                : `${othersHere.length} others are here now`}
            </span>
          ) : (
            <span>You're {role === 'owner' ? 'the owner' : role === 'editor' ? 'an editor' : 'a viewer'}</span>
          )}
        </p>
      </div>

      {!personal && (
        <div className="flex items-center gap-3">
          <div className="flex items-center" aria-label={`${members.length} people in this folder`} role="img">
            {members.slice(0, 4).map((m, i) => (
              <PersonAvatar
                key={m.recordId}
                userId={m.data.userId}
                name={getName(m.data.userId) ?? 'Member'}
                here={here.has(m.data.userId)}
                ringClassName="ring-background"
                className={cn('ring-2 ring-background', i > 0 && '-ml-1.5')}
              />
            ))}
            {members.length > 4 && (
              <span className="-ml-1.5 flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-[#3d4451] ring-2 ring-background">
                +{members.length - 4}
              </span>
            )}
          </div>
          {canManageFolder(role) && <DeleteFolderButton folderId={folderId} name={folder.name} />}
        </div>
      )}
    </header>
  )
}

function PanelTab({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'h-10 rounded-[9px] text-sm transition-colors',
        selected ? 'bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(15,18,23,0.08)]' : 'font-medium text-[#3d4451] hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function DeleteFolderButton({ folderId, name }: { folderId: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const { error } = useToast()

  async function remove() {
    setBusy(true)
    try {
      await callAction('deleteFolder', { folderId })
      navigate('/drive', { replace: true })
    } catch (err) {
      error('Could not delete the folder', (err as Error).message)
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        className="rounded-[10px] px-3 text-muted-foreground hover:bg-[#fdecea] hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 /> Delete folder
      </Button>
      <ConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={remove}
        loading={busy}
        variant="destructive"
        title={`Delete "${name}"?`}
        description="Every file in it is deleted for all members, and its invite links stop working. This can't be undone."
        confirmText="Delete folder"
      />
    </>
  )
}
