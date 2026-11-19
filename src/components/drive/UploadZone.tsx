/**
 * Drag-and-drop / pick-files upload, following the design doc's upload flow:
 *   1. fingerprint the file (SHA-256) and skip it if this folder already has it;
 *   2. upload the bytes straight to storage (the uploader's private R2 folder;
 *      the SDK switches to multipart for large files on its own);
 *   3. register the metadata with the `addFile` action, which checks the
 *      caller's role and makes the file appear live for every member.
 * If step 3 is refused, the uploaded bytes are deleted again.
 */

import { useRef, useState, type DragEvent } from 'react'
import { useR2Files } from 'deepspace'
import { CheckCircle2, CircleAlert, Copy, Eye, Loader2, Upload } from 'lucide-react'
import { cn, useToast } from '@/components/ui'
import { callAction, sha256Hex } from '../../lib/api'
import { formatBytes, MAX_FILE_BYTES } from '../../lib/drive'

type UploadState = 'hashing' | 'uploading' | 'saving' | 'done' | 'duplicate' | 'error'
interface UploadItem {
  id: string
  name: string
  state: UploadState
  message?: string
}

export function UploadZone({
  folderId,
  fingerprints,
  canUpload,
  personal,
}: {
  folderId: string
  /** Fingerprints of files already in the folder (from the live file list). */
  fingerprints: Set<string>
  canUpload: boolean
  /** The user's own drop (changes the hint text only). */
  personal: boolean
}) {
  const { upload, deleteFile } = useR2Files()
  const [items, setItems] = useState<UploadItem[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { error } = useToast()

  const patch = (id: string, next: Partial<UploadItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it)))

  async function uploadOne(file: File) {
    const id = crypto.randomUUID()
    const item: UploadItem = { id, name: file.name, state: 'hashing' }
    setItems((prev) => [item, ...prev].slice(0, 8))
    if (file.size === 0) return patch(id, { state: 'error', message: 'Empty file' })
    if (file.size > MAX_FILE_BYTES) {
      return patch(id, { state: 'error', message: `Over the ${formatBytes(MAX_FILE_BYTES)} limit` })
    }

    const fingerprint = await sha256Hex(file)
    if (fingerprints.has(fingerprint)) return patch(id, { state: 'duplicate', message: 'Already in this folder' })

    patch(id, { state: 'uploading' })
    // Stored as opaque bytes: the platform refuses active types (HTML, SVG,
    // JS) by declared type, and ezshare never renders stored files anyway —
    // the download route always serves them as nosniff attachments.
    const result = await upload(new Blob([file], { type: 'application/octet-stream' }), file.name, {
      key: `folders/${folderId}/${crypto.randomUUID()}`,
    })
    if (!result.success || !result.key) {
      return patch(id, { state: 'error', message: result.error ?? 'Upload failed' })
    }

    patch(id, { state: 'saving' })
    try {
      await callAction('addFile', {
        folderId,
        storageKey: result.key,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        fingerprint,
      })
      patch(id, { state: 'done' })
      setTimeout(() => setItems((prev) => prev.filter((it) => it.id !== id)), 2500)
    } catch (err) {
      await deleteFile(result.key) // don't leave orphaned bytes in storage
      patch(id, { state: 'error', message: (err as Error).message })
    }
  }

  async function handleFiles(list: FileList | null) {
    if (!list || !canUpload) return
    // One at a time keeps memory flat and the per-file status readable.
    for (const file of Array.from(list)) {
      try {
        await uploadOne(file)
      } catch (err) {
        error(`Could not upload ${file.name}`, (err as Error).message)
      }
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    void handleFiles(e.dataTransfer.files)
  }

  if (!canUpload) {
    return (
      <p className="flex items-center gap-3 rounded-2xl border border-dashed border-input bg-card px-5 py-4 text-sm text-muted-foreground">
        <Eye className="size-5 shrink-0 text-[#3d4451]" aria-hidden />
        You can view and download files here. Ask the folder owner for an editor link to upload.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex w-full items-center gap-4 rounded-2xl border-[1.5px] border-dashed p-4 text-left transition-colors sm:px-[22px] sm:py-5',
          dragging ? 'border-primary bg-accent' : 'border-[#c3cbd8] bg-card hover:border-primary/60',
        )}
      >
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground sm:size-12 sm:bg-accent sm:text-primary"
        >
          <Upload className="size-5 sm:size-[22px]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-foreground">
            <span className="sm:hidden">Tap to add files</span>
            <span className="hidden sm:inline">{dragging ? 'Drop to upload' : personal ? 'Drop files here' : 'Drop files here to share them'}</span>
          </span>
          <span className="text-[13px] text-muted-foreground">
            <span className="sm:hidden">Up to {formatBytes(MAX_FILE_BYTES)} each</span>
            <span className="hidden sm:inline">
              Up to {formatBytes(MAX_FILE_BYTES)} each.{' '}
              {personal
                ? "They show up on every device you're signed in on."
                : 'They show up for everyone in this folder, on every device.'}
            </span>
          </span>
        </span>
        <span
          aria-hidden
          className="hidden h-10 shrink-0 items-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground sm:inline-flex"
        >
          Choose files
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        data-testid="file-input"
        onChange={(e) => {
          void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {items.length > 0 && (
        <ul className="space-y-1.5 pt-1.5" aria-live="polite">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-[13px]"
            >
              <StateIcon state={it.state} />
              <span className="min-w-0 truncate font-medium">{it.name}</span>
              <span
                className={cn(
                  'ml-auto shrink-0',
                  it.state === 'done' ? 'font-medium text-success' : it.state === 'error' ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {it.message ?? LABELS[it.state]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const LABELS: Record<UploadState, string> = {
  hashing: 'Checking…',
  uploading: 'Uploading…',
  saving: 'Saving…',
  done: 'Uploaded',
  duplicate: 'Already here',
  error: 'Failed',
}

function StateIcon({ state }: { state: UploadState }) {
  if (state === 'done') return <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
  if (state === 'duplicate') return <Copy className="size-4 shrink-0 text-muted-foreground" aria-hidden />
  if (state === 'error') return <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
  return <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
}
