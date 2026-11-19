/**
 * Small presentational pieces shared by the drive screens: the logo mark,
 * file-type tiles, people avatars, folder tiles and status pills. Colours come
 * from the Claude Design mockup; each text/background pair passes WCAG AA.
 *
 * Tailwind only generates classes it can see as whole strings, so the tint
 * tables below spell every class out in full.
 */

import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/components/ui'
import { fileBadge, initials, pickIndex, type FileKind } from '../../lib/drive'

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-primary', className)}>
      <ArrowUpRight className="size-4 text-primary-foreground" strokeWidth={2.6} aria-hidden />
    </span>
  )
}

const FILE_TINTS: Record<FileKind, string> = {
  pdf: 'bg-[#fdecea] text-[#b0302a]',
  image: 'bg-[#f1eafe] text-[#6a31c4]',
  doc: 'bg-[#ebf0ff] text-[#1e44c9]',
  sheet: 'bg-[#e6f5ee] text-[#11684a]',
  text: 'bg-[#eef0f3] text-[#3d4451]',
  code: 'bg-[#e0f0f4] text-[#0f6170]',
  media: 'bg-[#fff4e0] text-[#8f5400]',
  archive: 'bg-[#f3efe9] text-[#5c4a32]',
  other: 'bg-[#eef0f3] text-[#3d4451]',
}

const TILE_SIZES = {
  sm: 'size-[22px] rounded-md text-[8px]',
  md: 'size-[38px] rounded-[10px] text-[10px]',
  lg: 'size-10 rounded-[10px] text-[10px]',
}

/** A coloured square with the file's extension ("PDF", "JPG"). */
export function FileTile({ name, size = 'md' }: { name: string; size?: keyof typeof TILE_SIZES }) {
  const { kind, label } = fileBadge(name)
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center font-bold tracking-[0.04em]',
        TILE_SIZES[size],
        FILE_TINTS[kind],
      )}
    >
      {label}
    </span>
  )
}

const PEOPLE_TINTS = [
  'bg-[#dce5ff] text-[#1e44c9]',
  'bg-[#ede3fd] text-[#6a31c4]',
  'bg-[#ddf2e8] text-[#11684a]',
  'bg-[#ffe9d6] text-[#8a4300]',
  'bg-[#fde4ec] text-[#a3234f]',
  'bg-[#e0f0f4] text-[#0f6170]',
]

/** Initials on a colour picked from the user id, with an optional "here now" dot. */
export function PersonAvatar({
  userId,
  name,
  here = false,
  className,
  ringClassName = 'ring-card',
}: {
  userId: string
  name: string
  here?: boolean
  className?: string
  /** Ring colour, so overlapping avatars and the presence dot cut out cleanly. */
  ringClassName?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        PEOPLE_TINTS[pickIndex(userId, PEOPLE_TINTS.length)],
        className,
      )}
    >
      {initials(name)}
      {here && (
        <span className={cn('absolute -bottom-px -right-px size-2.5 rounded-full bg-[#1f9d6b] ring-2', ringClassName)} />
      )}
    </span>
  )
}

/** The letter tile beside a shared folder's name. */
export function FolderTile({ folderId, name, active }: { folderId: string; name: string; active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-[26px] shrink-0 items-center justify-center rounded-[7px] text-xs font-bold max-md:size-6 max-md:rounded-full max-md:text-[11px]',
        active ? 'bg-primary text-primary-foreground' : PEOPLE_TINTS[pickIndex(folderId, PEOPLE_TINTS.length)],
      )}
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

const PILL_TONES = {
  green: 'bg-[#e6f5ee] text-success',
  amber: 'bg-[#fff4e0] text-warning',
  blue: 'bg-accent text-accent-foreground',
  neutral: 'bg-muted text-muted-foreground',
}

export function Pill({
  tone,
  children,
  className,
  title,
}: {
  tone: keyof typeof PILL_TONES
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold [&_svg]:size-3',
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** The green "someone is here" dot used in headers and the People panel. */
export function HereDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn('size-2 shrink-0 rounded-full bg-[#1f9d6b]', className)} />
}
