/**
 * "Ask this folder": a single question → an answer grounded in this folder's
 * documents, with numbered sources that link to the files.
 *
 * While any file is still being indexed, it asks the worker to copy the
 * knowledge base's status onto the file records every few seconds, so every
 * member sees "AI ready" appear live.
 */

import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button, Textarea } from '@/components/ui'
import { callAction, downloadUrl } from '../../lib/api'
import { FileTile, Pill } from './visuals'

interface AskResult {
  answer: string | null
  sources: { n: number; fileId: string; name: string }[]
  note?: string
}

export function AskPanel({
  folderId,
  indexingCount,
  readyCount,
  tooLargeCount,
}: {
  folderId: string
  indexingCount: number
  readyCount: number
  /** Documents skipped only because they're over the 4 MB indexing limit. */
  tooLargeCount: number
}) {
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [result, setResult] = useState<AskResult | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    setResult(null)
    setFailure(null)
  }, [folderId])

  useEffect(() => {
    if (indexingCount === 0) return
    let attempts = 0
    const timer = setInterval(() => {
      attempts++
      callAction('refreshIndex', { folderId }).catch(() => {})
      if (attempts >= 40) clearInterval(timer) // ~4 minutes, then stop polling
    }, 6000)
    return () => clearInterval(timer)
  }, [folderId, indexingCount])

  async function ask(e: FormEvent) {
    e.preventDefault()
    if (!question.trim()) return
    setAsking(true)
    setFailure(null)
    try {
      setResult(await callAction<AskResult>('askFolder', { folderId, question: question.trim() }))
    } catch (err) {
      setFailure((err as Error).message)
    } finally {
      setAsking(false)
    }
  }

  return (
    <section
      aria-labelledby="ask-heading"
      className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,18,23,0.04)] sm:p-[18px]"
    >
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="flex size-8 items-center justify-center rounded-[9px] bg-accent text-primary">
          <Sparkles className="size-[17px]" />
        </span>
        <h2 id="ask-heading" className="text-base font-semibold tracking-[-0.01em]">
          Ask this folder
        </h2>
      </div>
      <p className="mt-2.5 text-[13px] text-muted-foreground">
        Answers come only from this folder's documents, with numbered sources.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Pill tone={readyCount > 0 ? 'green' : 'neutral'}>
          {readyCount} document{readyCount === 1 ? '' : 's'} ready
        </Pill>
        {indexingCount > 0 && <Pill tone="amber">{indexingCount} indexing</Pill>}
        {tooLargeCount > 0 && (
          <Pill tone="neutral" title="AI search reads documents up to 4 MB">
            {tooLargeCount} over 4 MB
          </Pill>
        )}
      </div>
      {readyCount === 0 && indexingCount === 0 && (
        <p className="mt-2.5 text-[13px] text-muted-foreground">
          AI search reads the text in PDF, Word, text, Markdown, CSV, JSON and code files up to 4 MB. Scanned PDFs
          (pages that are only images) may not be searchable.
        </p>
      )}

      <form onSubmit={ask} className="mt-3.5 space-y-2.5">
        <Textarea
          aria-label="Question about this folder"
          placeholder="e.g. What's the deadline in the project brief?"
          rows={3}
          maxLength={1000}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void ask(e)
          }}
          className="resize-none rounded-xl px-3 py-2.5 text-sm"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">Ctrl + Enter to ask</span>
          <Button type="submit" className="ml-auto rounded-[10px] font-semibold" disabled={asking || !question.trim()}>
            {asking ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {asking ? 'Reading files…' : 'Ask'}
          </Button>
        </div>
      </form>

      {failure && <p className="mt-3 text-sm text-destructive">{failure}</p>}
      {result && (
        <div className="mt-4 rounded-xl border border-[#eef0f3] bg-background p-3.5 text-sm" data-testid="ask-answer">
          {result.answer ? (
            <p className="whitespace-pre-wrap leading-relaxed text-foreground">
              <CitedText text={result.answer} known={new Set(result.sources.map((s) => s.n))} />
            </p>
          ) : (
            <p className="text-muted-foreground">{result.note}</p>
          )}
          {result.sources.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground">Sources</p>
              <ol className="mt-1">
                {result.sources.map((s) => (
                  <li key={s.fileId}>
                    <a
                      className="flex min-h-8 items-center gap-2 text-[13px] font-medium text-foreground hover:text-primary"
                      href={downloadUrl(s.fileId)}
                      download={s.name}
                    >
                      <CiteChip n={s.n} />
                      <FileTile name={s.name} size="sm" />
                      <span className="truncate">{s.name}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Each person can ask 25 questions a day.</p>
    </section>
  )
}

/** Shows the answer's "[2]" markers as small numbered chips (only for numbers that are real sources). */
function CitedText({ text, known }: { text: string; known: Set<number> }) {
  const parts = text.split(/(\[\d+\])/)
  return (
    <>
      {parts.map((part, i) => {
        const n = /^\[(\d+)\]$/.exec(part)?.[1]
        return n && known.has(Number(n)) ? <CiteChip key={i} n={Number(n)} inline /> : part
      })}
    </>
  )
}

function CiteChip({ n, inline = false }: { n: number; inline?: boolean }) {
  return (
    <span
      aria-hidden={!inline}
      className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-md bg-accent px-[5px] align-[1px] text-[11px] font-semibold text-accent-foreground"
    >
      {inline ? <span className="sr-only">source </span> : null}
      {n}
    </span>
  )
}
