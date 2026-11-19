/**
 * Landing page — a STATIC page (no auth fetch, no WebSocket), prerendered at
 * build so crawlers and link previews read real content. The app itself
 * lives under /drive.
 *
 * It deliberately imports nothing from the UI kit, so the first page anyone
 * sees stays a small bundle. The preview card on the right is plain markup
 * showing the real features (files, "AI ready", a cited answer).
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, HardDrive, Sparkles, Users } from 'lucide-react'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

const FEATURES: { title: string; body: string; icon: ReactNode; tint: string }[] = [
  {
    title: 'Your drop, on every device',
    body: 'Drop a file on your laptop and it is already on your phone. No cables, no emailing yourself.',
    icon: <HardDrive className="size-[19px]" />,
    tint: 'bg-[#eef0f3] text-[#3d4451]',
  },
  {
    title: 'Shared folders, real access control',
    body: 'Invite people with an editor or viewer link. Files stay private to the folder, checked on the server for every download.',
    icon: <Users className="size-[19px]" />,
    tint: 'bg-[#ebf0ff] text-[#2b59f5]',
  },
  {
    title: 'Ask the folder',
    body: 'Ask a question and get an answer drawn only from that folder’s documents, with numbered sources.',
    icon: <Sparkles className="size-[19px]" />,
    tint: 'bg-[#e6f5ee] text-[#157a52]',
  },
]

const PREVIEW_FILES = [
  { name: 'flight-confirmation.pdf', label: 'PDF', size: '182 KB', tint: 'bg-[#fdecea] text-[#b0302a]', status: 'AI ready' },
  { name: 'itinerary.md', label: 'MD', size: '4 KB', tint: 'bg-[#eef0f3] text-[#3d4451]', status: 'AI ready' },
  { name: 'tram-28.jpg', label: 'JPG', size: '2.4 MB', tint: 'bg-[#f1eafe] text-[#6a31c4]', status: 'New' },
]

const PREVIEW_PEOPLE = [
  { initials: 'JL', tint: 'bg-[#dce5ff] text-[#1e44c9]' },
  { initials: 'MC', tint: 'bg-[#ede3fd] text-[#6a31c4]' },
  { initials: 'SO', tint: 'bg-[#ddf2e8] text-[#11684a]' },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="min-h-screen bg-background text-[15px] text-foreground">
        <header className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Link to="/" className="flex items-center gap-2.5 text-foreground">
            <span className="flex size-8 items-center justify-center rounded-[9px] bg-primary">
              <ArrowUpRight className="size-[17px] text-white" strokeWidth={2.6} aria-hidden />
            </span>
            <span className="text-[19px] font-bold tracking-[-0.03em]">ezshare</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/drive"
              className="inline-flex h-10 items-center rounded-[10px] px-3.5 text-sm font-medium text-[#3d4451] hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              to="/drive"
              className="hidden h-10 items-center rounded-[10px] bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 sm:inline-flex"
            >
              Open your drop
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-[1200px] px-6 pb-16 pt-6 sm:pt-10">
          <div className="flex flex-wrap items-center gap-14">
            <div className="min-w-0 flex-[1_1_420px]">
              <span className="inline-flex h-[30px] items-center gap-2 rounded-full border border-border bg-card px-3 text-[13px] font-medium text-[#3d4451]">
                <span className="size-[7px] rounded-full bg-primary" aria-hidden />
                File drop · Shared folders · Ask your files
              </span>
              <h1 className="mt-6 text-[clamp(2.5rem,4.6vw,4.25rem)] font-bold leading-[1.02] tracking-[-0.04em]">
                Get a file from here to there. <span className="text-primary">Or to them.</span>
              </h1>
              <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-[#4a5260]">
                Send files to yourself across devices, share folders with the people you choose, and ask
                questions about what’s inside.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/drive"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-[22px] text-[15px] font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Open your drop <ArrowRight className="size-4" aria-hidden />
                </Link>
                <span className="text-sm text-muted-foreground">Free · sign in with Google or GitHub</span>
              </div>
            </div>

            <div className="min-w-0 flex-[1_1_460px]" aria-hidden>
              <div className="overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_24px_48px_-16px_rgba(15,18,23,0.18),0_2px_6px_rgba(15,18,23,0.04)]">
                <div className="flex items-center justify-between gap-3 border-b border-[#eef0f3] px-[18px] py-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
                      T
                    </span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold">Trip to Lisbon</p>
                      <p className="text-xs text-muted-foreground">3 people · Maya is here now</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {PREVIEW_PEOPLE.map((p, i) => (
                      <span
                        key={p.initials}
                        className={`flex size-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold ${p.tint} ${i > 0 ? '-ml-1.5' : ''}`}
                      >
                        {p.initials}
                      </span>
                    ))}
                  </div>
                </div>
                <ul className="px-[18px] py-1">
                  {PREVIEW_FILES.map((f, i) => (
                    <li
                      key={f.name}
                      className={`flex items-center gap-3 py-2.5 ${i < PREVIEW_FILES.length - 1 ? 'border-b border-[#eef0f3]' : ''}`}
                    >
                      <span
                        className={`flex size-[34px] shrink-0 items-center justify-center rounded-[9px] text-[9px] font-bold tracking-[0.04em] ${f.tint}`}
                      >
                        {f.label}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span>
                      <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{f.size}</span>
                      <span
                        className={`inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-semibold ${
                          f.status === 'New' ? 'bg-accent text-accent-foreground' : 'bg-[#e6f5ee] text-success'
                        }`}
                      >
                        {f.status}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mx-[18px] mb-[18px] mt-1 rounded-[14px] border border-[#eef0f3] bg-background p-3.5">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-[#3d4451]">
                    <Sparkles className="size-3.5 text-primary" /> When do we land?
                  </p>
                  <p className="mt-2 text-sm leading-relaxed">
                    At 07:40 on Friday, into Lisbon{' '}
                    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-md bg-accent px-[5px] align-[1px] text-[11px] font-semibold text-accent-foreground">
                      1
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Source: flight-confirmation.pdf</p>
                </div>
              </div>
            </div>
          </div>

          <section aria-label="What ezshare does" className="mt-20 flex flex-wrap gap-4 sm:mt-24">
            {FEATURES.map((f) => (
              <div key={f.title} className="min-w-0 flex-[1_1_280px] rounded-2xl border border-border bg-card p-[22px]">
                <span className={`flex size-10 items-center justify-center rounded-[11px] ${f.tint}`} aria-hidden>
                  {f.icon}
                </span>
                <h2 className="mt-4 text-[17px] font-semibold tracking-[-0.015em]">{f.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[#4a5260]">{f.body}</p>
              </div>
            ))}
          </section>

          <p className="mt-10 text-[13px] text-muted-foreground">
            Files up to 10 MB. Built on DeepSpace for a take-home exercise. Please don’t store anything sensitive.
          </p>
        </main>
      </div>
    </>
  )
}
