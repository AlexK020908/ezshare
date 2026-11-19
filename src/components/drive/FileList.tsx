/**
 * The folder's files. `records` comes from a live `useQuery`, so a file
 * uploaded on another device or by another member appears here without a
 * refresh (the design doc's "sync" requirement, done by DeepSpace's sync).
 *
 * Layout: a table when the list is at least 36rem wide (a container query,
 * so it follows the column's width, not the window's), compact two-line rows
 * when narrower. Each row renders every piece once and only moves it between
 * grid cells (`grid-area: row-start / col-start / row-end / col-end`), so
 * tests and screen readers see one "AI ready", one link, etc.
 */

import { useState } from 'react'
import type { RecordData } from 'deepspace'
import { useUserLookup } from 'deepspace'
import { Download, FolderOpen, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { Button, ConfirmModal, useToast } from '@/components/ui'
import { callAction, downloadUrl } from '../../lib/api'
import { aiSkipReason, canDeleteFile, formatBytes } from '../../lib/drive'
import type { FolderRole } from '../../schemas/drive-schemas'
import type { FileRow } from '../../server/drive-access'
import { FileTile, Pill } from './visuals'

const TABLE_COLUMNS = '@xl:grid-cols-[38px_minmax(0,1fr)_84px_104px_116px_88px]'

export function FileList({
  files,
  role,
  userId,
  personal,
}: {
  files: RecordData<FileRow>[]
  role: FolderRole | null
  userId: string
  personal: boolean
}) {
  const { getName } = useUserLookup()
  const [pendingDelete, setPendingDelete] = useState<RecordData<FileRow> | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { error, success } = useToast()

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await callAction('deleteFile', { fileId: pendingDelete.recordId })
      success('Deleted', pendingDelete.data.name)
      setPendingDelete(null)
    } catch (err) {
      error('Could not delete', (err as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  if (files.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-muted text-[#3d4451]">
          <FolderOpen className="size-5" aria-hidden />
        </span>
        <p className="mt-3 font-semibold">No files yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {personal
            ? "Add a file here and it's on every device you're signed in on."
            : 'Files added here show up for everyone in the folder, live.'}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="@container overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(15,18,23,0.04)]">
        <div
          className={`hidden items-center gap-x-3 border-b border-border bg-[#fafbfc] px-4 py-2.5 text-xs font-semibold text-muted-foreground @xl:grid ${TABLE_COLUMNS}`}
        >
          <span className="col-span-2">Name</span>
          <span>Size</span>
          <span>Added</span>
          <span>AI search</span>
          <span className="text-right">Actions</span>
        </div>
        <ul className="divide-y divide-[#eef0f3]" data-testid="file-list">
          {files.map((f) => {
            const uploader = f.data.uploaderId === userId ? 'you' : (getName(f.data.uploaderId) ?? 'someone')
            const when = timeAgo(f.createdAt)
            return (
              <li
                key={f.recordId}
                data-testid="file-row"
                className={`grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-0.5 py-2.5 pl-3 pr-1 @xl:gap-y-0 @xl:px-4 @xl:py-3 ${TABLE_COLUMNS}`}
              >
                <div className="[grid-area:1/1/3/2] @xl:[grid-area:1/1/2/2]">
                  <FileTile name={f.data.name} />
                </div>
                <div className="min-w-0 self-end [grid-area:1/2/2/4] @xl:self-center @xl:[grid-area:1/2/2/3]">
                  <p className="truncate text-sm font-medium text-foreground">{f.data.name}</p>
                  <p className="mt-0.5 hidden truncate text-xs text-muted-foreground @xl:block">
                    Added by {uploader}
                  </p>
                </div>
                <p className="min-w-0 self-start truncate text-xs text-muted-foreground [grid-area:2/2/3/3] @xl:hidden">
                  {formatBytes(f.data.size)} · {capitalize(uploader)} · {when}
                </p>
                <span className="hidden font-mono text-[13px] text-[#3d4451] @xl:block @xl:[grid-area:1/3/2/4]">
                  {formatBytes(f.data.size)}
                </span>
                <span className="hidden text-[13px] text-muted-foreground @xl:block @xl:[grid-area:1/4/2/5]">
                  {when}
                </span>
                <div className="self-start [grid-area:2/3/3/4] @xl:self-center @xl:[grid-area:1/5/2/6]">
                  <AiBadge status={f.data.aiStatus} name={f.data.name} size={f.data.size} />
                </div>
                <div className="flex justify-end [grid-area:1/4/3/5] @xl:[grid-area:1/6/2/7]">
                  <a
                    href={downloadUrl(f.recordId)}
                    download={f.data.name}
                    aria-label={`Download ${f.data.name}`}
                    className="inline-flex size-11 items-center justify-center rounded-[10px] text-[#3d4451] hover:bg-muted hover:text-foreground @xl:size-10"
                  >
                    <Download className="size-[17px]" />
                  </a>
                  {canDeleteFile(role, f.data.uploaderId, userId) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 rounded-[10px] text-muted-foreground hover:bg-[#fdecea] hover:text-destructive @xl:size-10"
                      aria-label={`Delete ${f.data.name}`}
                      onClick={() => setPendingDelete(f)}
                    >
                      <Trash2 className="size-[17px]" />
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      <ConfirmModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        variant="destructive"
        title="Delete this file?"
        description={`"${pendingDelete?.data.name ?? ''}" will be removed for everyone in this folder. This can't be undone.`}
        confirmText="Delete"
      />
    </>
  )
}

function AiBadge({ status, name, size }: { status: FileRow['aiStatus']; name: string; size: number }) {
  if (status === 'ready') {
    return (
      <Pill tone="green" className="@max-xl:h-5 @max-xl:px-2 @max-xl:text-[11px]">
        <Sparkles aria-hidden /> AI ready
      </Pill>
    )
  }
  if (status === 'indexing') {
    return (
      <Pill tone="amber" className="@max-xl:h-5 @max-xl:px-2 @max-xl:text-[11px]">
        <Loader2 className="animate-spin" aria-hidden /> Indexing
      </Pill>
    )
  }
  if (status === 'error') {
    return (
      <Pill tone="neutral" title="The AI could not read this file" className="@max-xl:h-5 @max-xl:px-2 @max-xl:text-[11px]">
        Not indexed
      </Pill>
    )
  }
  // Skipped. A document that's only too big gets a visible reason; other
  // types (images, media) get nothing on phones and a dash in the table.
  if (aiSkipReason(name, size) === 'too_large') {
    return (
      <Pill tone="neutral" title="AI search reads documents up to 4 MB" className="@max-xl:h-5 @max-xl:px-2 @max-xl:text-[11px]">
        Over 4 MB
      </Pill>
    )
  }
  return (
    <span className="hidden text-[13px] text-muted-foreground @xl:inline" title="AI search doesn't read this file type">
      —
    </span>
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
