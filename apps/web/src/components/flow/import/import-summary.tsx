import { useState, type ChangeEvent } from 'react'
import { AlertCircle, AlertTriangle, Check, ExternalLink, Loader2, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { importErrorMessage, pasteIdl, type ImportResult } from '@/hooks/import/tx-import'
import { rememberUserIdl } from '@/utils/idl/sources/user'
import { IDL_HINTS } from './idl-hints'

interface ImportSummaryProps {
  result: ImportResult
  /** The transaction imported again with a pasted IDL: the caller puts its flow on the canvas. */
  onResult: (result: ImportResult) => void
  onDismiss: () => void
  /** Offer "Remember for this program" (the editor). */
  canRemember: boolean
}

const buttonClass =
  'flex cursor-pointer items-center gap-1 rounded-md border border-border bg-card px-2 py-1 font-mono text-[11px] text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

interface ProgramRowProps {
  programId: string
  instructionCount: number
  result: ImportResult
  onResult: (result: ImportResult) => void
  canRemember: boolean
  /** Another row is applying its IDL: the result it starts from is about to change. */
  locked: boolean
  onBusy: (busy: boolean) => void
}

const ProgramRow = ({
  programId,
  instructionCount,
  result,
  onResult,
  canRemember,
  locked,
  onBusy,
}: ProgramRowProps) => {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; reasons: string[] } | null>(null)
  const [decoded, setDecoded] = useState<number | null>(null)
  const hint = IDL_HINTS[programId]

  const apply = async (idlText: string) => {
    setBusy(true)
    onBusy(true)
    setError(null)
    try {
      const pasted = await pasteIdl(result, programId, idlText)
      if (pasted.decoded === 0) {
        setError({ message: 'None of its instructions decode with this IDL', reasons: pasted.warnings })
        return
      }
      if (canRemember && remember) rememberUserIdl(programId, idlText)
      setDecoded(pasted.decoded)
      setOpen(false)
      onResult(pasted.result)
    } catch (e) {
      setError({ message: importErrorMessage(e), reasons: [] })
    } finally {
      setBusy(false)
      onBusy(false)
    }
  }

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const content = await file.text()
    setText(content)
    setOpen(true)
    await apply(content)
  }

  return (
    <li className="flex flex-col gap-1.5 border-t border-border pt-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-foreground">{hint?.name ?? 'Program'}</span>
        <span className="shrink-0 text-muted-foreground">{plural(instructionCount, 'instruction')}</span>
      </div>
      <span className="break-all text-[10px] text-muted-foreground select-all">{programId}</span>
      {hint && (
        <a
          href={hint.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-1 text-[10px] leading-4 text-muted-foreground underline hover:text-foreground"
        >
          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
          {hint.note}
        </a>
      )}
      {decoded !== null ? (
        <span className="flex items-center gap-1 text-green-600">
          <Check className="h-3.5 w-3.5" />
          Decoded {decoded} of {instructionCount} with the pasted IDL (unverified)
        </span>
      ) : (
        <>
          {open ? (
            <>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste the program's IDL (Anchor, Codama or Shank JSON)"
                spellCheck={false}
                className="h-24 w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[10px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
              <span className="text-[10px] text-muted-foreground">
                Applying rebuilds the flow from the transaction: edits made since the import are lost.
              </span>
              <div className="flex items-center justify-between gap-2">
                {canRemember ? (
                  <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(event) => setRemember(event.target.checked)}
                      className="cursor-pointer accent-primary"
                    />
                    Remember for this program
                  </label>
                ) : (
                  <span />
                )}
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setOpen(false)} className={buttonClass}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!text.trim() || busy || locked}
                    onClick={() => void apply(text)}
                    className={cn(buttonClass, 'border-primary')}
                  >
                    {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                    Apply
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex gap-1.5">
              <button type="button" disabled={locked} onClick={() => setOpen(true)} className={buttonClass}>
                Paste IDL
              </button>
              <label className={cn(buttonClass, locked && 'pointer-events-none opacity-50')}>
                <Upload className="h-3 w-3" />
                Upload file
                <input
                  type="file"
                  accept=".json,application/json"
                  disabled={locked}
                  onChange={(event) => void upload(event)}
                  className="sr-only"
                />
              </label>
            </div>
          )}
          {error && (
            <div className="flex flex-col gap-0.5 text-[10px] text-red-500">
              <span className="flex items-start gap-1 break-words">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                {error.message}
              </span>
              {error.reasons.map((reason) => (
                <span key={reason} className="break-words text-muted-foreground">
                  {reason}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </li>
  )
}

/**
 * What an import decoded, with an optional IDL paste for each program that had none. Pasting imports the
 * transaction again: instructions that now decode and still rebuild the same bytes become PROGRAM INSTRUCTIONS.
 */
export const ImportSummary = ({ result, onResult, onDismiss, canRemember }: ImportSummaryProps) => {
  // The programs that had no IDL at import time; a row stays after its paste, showing the outcome.
  const [programs] = useState(() => result.summary.missingIdls)
  const [busy, setBusy] = useState(false)
  const { decoded, total } = result.summary

  return (
    <div className="absolute top-3 right-3 z-10 flex max-h-[calc(100%-1.5rem)] w-[380px] max-w-[calc(100%-1.5rem)] flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-card p-3 font-mono text-xs text-foreground shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          {decoded === total && <Check className="h-3.5 w-3.5 text-green-600" />}
          Decoded {decoded} of {plural(total, 'instruction')}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close the import summary"
          className="cursor-pointer rounded-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {result.warnings.map((warning) => (
        <span key={warning} className="flex items-start gap-1 break-words text-[10px] text-yellow-600">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {warning}
        </span>
      ))}
      {programs.length > 0 && (
        <>
          <span className="text-[10px] leading-4 text-muted-foreground">
            No IDL was found for {plural(programs.length, 'program')}: their instructions are RAW INSTRUCTION nodes.
            Pasting an IDL (optional) imports the transaction again and replaces the canvas.
          </span>
          <ul className="flex flex-col gap-2">
            {programs.map(({ programId, instructionCount }) => (
              <ProgramRow
                key={programId}
                programId={programId}
                instructionCount={instructionCount}
                result={result}
                onResult={onResult}
                canRemember={canRemember}
                locked={busy}
                onBusy={setBusy}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
