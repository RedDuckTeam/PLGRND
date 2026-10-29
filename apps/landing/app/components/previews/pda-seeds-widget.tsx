'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  generateKeyPair,
  getAddressEncoder,
  getAddressFromPublicKey,
  getProgramDerivedAddress,
  isAddress,
  type ReadonlyUint8Array,
} from '@solana/kit'

type Input = 'program' | 'seed' | 'signer'
type Values = Record<Input, string>
type Derived = { pda: string; bump: number } | { error: string }
type BlockProps = { inputs: Input[]; program?: string; programLabel?: string }

const PROGRAM_ID = 'BZLiJ62bzRryYp9mRobz47uA66WDgtfTXhhgM25tJyx5'
const MAX_SEED_BYTES = 32

const KIND_COLORS = { TEXT: 'bg-[#5b1f33]', KEYPAIR: 'bg-[#1e5f74]', PDA: 'bg-[#5b2a6e]' }

const LABELS: Record<Input, string> = { program: 'program id', seed: 'static seed', signer: 'signer' }

const EXAMPLES: (BlockProps & { title: string; text: string })[] = [
  {
    title: 'seeds = []',
    text: 'No seeds: the PDA depends only on the program id.',
    inputs: ['program'],
  },
  {
    title: 'seeds = [b"hello_world"]',
    text: 'Change the program id or the seed and the PDA changes.',
    inputs: ['program', 'seed'],
  },
  {
    title: 'seeds = [b"hello_world", signer.key().as_ref()]',
    text: 'Press Generate or paste a public key: a new signer gives a new PDA, the other examples do not change.',
    inputs: ['program', 'seed', 'signer'],
  },
  {
    title: 'seeds = [b"hello_world"], seeds::program = other_program.key()',
    text: 'The PDA is derived from other_program, so the address changes even with the same seeds.',
    inputs: ['program', 'seed'],
    program: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    programLabel: 'other program id',
  },
]

async function derive(inputs: Input[], values: Values): Promise<Derived> {
  const programAddress = values.program.trim()
  if (!isAddress(programAddress)) return { error: 'The program id is not a valid base58 address.' }

  const seeds: ReadonlyUint8Array[] = []
  for (const input of inputs) {
    if (input === 'seed') {
      const bytes = new TextEncoder().encode(values.seed)
      if (bytes.length > MAX_SEED_BYTES) {
        return { error: `A seed can be at most ${MAX_SEED_BYTES} bytes; this one has ${bytes.length}.` }
      }
      seeds.push(bytes)
    } else if (input === 'signer') {
      const signer = values.signer.trim()
      if (!isAddress(signer)) return { error: 'The signer is not a valid base58 public key.' }
      seeds.push(getAddressEncoder().encode(signer))
    }
  }

  try {
    const [pda, bump] = await getProgramDerivedAddress({ programAddress, seeds })
    return { pda, bump }
  } catch {
    return {
      error: window.isSecureContext
        ? 'No PDA could be derived from these inputs.'
        : 'WebCrypto (crypto.subtle) needs HTTPS or localhost.',
    }
  }
}

function Card({ kind, children }: { kind: keyof typeof KIND_COLORS; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-background text-xs">
      <div className="space-y-1.5 p-2">{children}</div>
      <div className={`py-0.5 text-center text-[11px] font-semibold tracking-wider text-white ${KIND_COLORS[kind]}`}>
        {kind}
      </div>
    </div>
  )
}

function Block({ inputs, program = PROGRAM_ID, programLabel = LABELS.program }: BlockProps) {
  const [values, setValues] = useState<Values>({ program, seed: 'hello_world', signer: '' })
  const [keygenFailed, setKeygenFailed] = useState(false)
  const [result, setResult] = useState<Derived>()
  const hasSigner = inputs.includes('signer')
  const labels = { ...LABELS, program: programLabel }

  const generate = useCallback(() => {
    generateKeyPair()
      .then(({ publicKey }) => getAddressFromPublicKey(publicKey))
      .then(
        (signer) => setValues((current) => ({ ...current, signer })),
        () => setKeygenFailed(true)
      )
  }, [])

  useEffect(() => {
    if (hasSigner) generate()
  }, [hasSigner, generate])

  useEffect(() => {
    let stale = false
    derive(inputs, values).then((derived) => {
      if (!stale) setResult(derived)
    })
    return () => {
      stale = true
    }
  }, [inputs, values])

  let output: ReactNode
  if (hasSigner && !values.signer.trim()) {
    output = <p className="text-muted-foreground">{keygenFailed ? 'Needs a signer' : '…'}</p>
  } else if (!result) {
    output = <p className="text-muted-foreground">…</p>
  } else if ('error' in result) {
    output = <p className="text-red-400">{result.error}</p>
  } else {
    output = (
      <>
        <p className="break-all text-foreground">{result.pda}</p>
        <p className="text-muted-foreground">bump {result.bump}</p>
      </>
    )
  }

  return (
    <div className="grid items-center gap-3 rounded-lg border border-border bg-sidebar p-3 sm:grid-cols-[3fr_auto_2fr]">
      <div className="space-y-3">
        {inputs.map((input) => (
          <Card key={input} kind={input === 'signer' ? 'KEYPAIR' : 'TEXT'}>
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              {labels[input]}
              {input === 'signer' && (
                <button
                  type="button"
                  onClick={generate}
                  className="rounded border border-accent px-2 py-0.5 font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Generate
                </button>
              )}
            </div>
            <input
              aria-label={labels[input]}
              value={values[input]}
              onChange={(event) => setValues({ ...values, [input]: event.target.value })}
              placeholder={input === 'signer' ? 'Paste a base58 public key' : undefined}
              spellCheck={false}
              autoComplete="off"
              className="w-full rounded border border-accent bg-muted px-2 py-1 font-mono text-[11px] text-foreground outline-none focus:border-primary"
            />
            {input === 'signer' && keygenFailed && (
              <p className="text-muted-foreground">
                Ed25519 is not supported in this browser. Paste a public key instead.
              </p>
            )}
          </Card>
        ))}
      </div>
      <div aria-hidden className="text-center text-muted-foreground">
        <span className="sm:hidden">↓</span>
        <span className="hidden sm:inline">→</span>
      </div>
      <Card kind="PDA">
        <div aria-live="polite" className="space-y-1 font-mono text-[11px]">
          {output}
        </div>
      </Card>
    </div>
  )
}

export function PdaSeedsFlow() {
  return (
    <div className="space-y-6">
      {EXAMPLES.map(({ title, text, ...block }) => (
        <section key={title} aria-label={title} className="space-y-2">
          <div>
            <code className="block text-sm font-semibold">{title}</code>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
          <Block {...block} />
        </section>
      ))}
    </div>
  )
}
