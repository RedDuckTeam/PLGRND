import bs58 from 'bs58'
import { pascalCase, type EventNode } from '@codama/nodes'
import { identifyEventData } from '@codama/dynamic-parsers'
import type { VersionedMessage } from '@solana/web3.js'
import { decodeInstruction, type InstructionInput } from '@/utils/idl/model/codec'
import type { ProgramIdl } from '@/utils/idl/model/program-idl'

type AccountMeta = InstructionInput['accounts'][number]

export interface TraceInstruction {
  programId: string
  accounts: AccountMeta[]
  data: Uint8Array
}

export interface TraceMessage {
  /** Static keys, then the loaded writable and readonly addresses: the order balances and indexes refer to. */
  accountKeys: AccountMeta[]
  instructions: TraceInstruction[]
}

// Fetched transactions reference keys by index; simulations by address, jsonParsed where the RPC can parse them.
type RpcInnerInstruction =
  | { programIdIndex: number; accounts: number[]; data: string; stackHeight?: number | null }
  | {
      programId: string
      accounts?: string[]
      data?: string
      parsed?: unknown
      program?: string
      stackHeight?: number | null
    }

interface RpcTokenBalance {
  accountIndex: number
  mint: string
  owner?: string
  uiTokenAmount: { amount: string; decimals: number }
}

export interface LoadedAddresses {
  writable: string[]
  readonly: string[]
}

/** A `getTransaction` meta or a `simulateTransaction` value (fields of both; simulations may lack fee and balances). */
export interface RpcExecution {
  err: unknown
  fee?: number | null
  computeUnitsConsumed?: number | null
  unitsConsumed?: number | null
  preBalances?: number[] | null
  postBalances?: number[] | null
  preTokenBalances?: RpcTokenBalance[] | null
  postTokenBalances?: RpcTokenBalance[] | null
  innerInstructions?: { index: number; instructions: RpcInnerInstruction[] }[] | null
  logMessages?: string[] | null
  logs?: string[] | null
  loadedAddresses?: LoadedAddresses | null
}

export interface TraceInput {
  message: TraceMessage
  execution: RpcExecution
  simulated: boolean
  /** The slot the transaction landed in, or the simulation's slot. */
  slot?: number
}

export interface TraceError {
  /** Top-level instruction that failed. */
  instructionIndex?: number
  /** The RPC error as JSON. */
  raw: string
  /** IDL error name for custom program errors when known, otherwise the runtime error name. */
  name?: string
  message?: string
  /** Program that raised a custom error, and its code. */
  programId?: string
  code?: number
}

export interface SolDelta {
  account: string
  /** SOL amounts as decimal strings; `delta` is signed. */
  before: string
  after: string
  delta: string
}

export interface TokenDelta {
  owner: string
  mint: string
  decimals: number
  /** UI amounts as decimal strings; `delta` is signed. */
  before: string
  after: string
  delta: string
}

export interface CpiEntry {
  programId: string
  /** IDL program name, or the RPC's parser name in simulations. */
  program?: string
  /** IDL instruction name, `event <Name>` for Anchor event self-CPIs, or the RPC-parsed type. */
  name?: string
  /** 1 for top-level instructions, as the runtime's `invoke [n]`. */
  depth: number
  children: CpiEntry[]
}

/** What a transaction did. Plain JSON (no bigint); fields the RPC did not return stay undefined. */
export interface TxTrace {
  status: 'success' | 'failed'
  error?: TraceError
  /** Lamports. */
  fee?: string
  computeUnits?: number
  /** Accounts whose balance changed. */
  solDeltas?: SolDelta[]
  /** Token balance changes per owner and mint. */
  tokenDeltas?: TokenDelta[]
  cpiTree: CpiEntry[]
  logs: string[]
  simulated?: { slot?: number }
}

// Anchor's emit_cpi! self-invocation carries an event, not an instruction (sha256("anchor:event")[0..8]).
const EVENT_CPI_TAG = [0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d]

/** Account keys (with message flags) and instructions of a message; v0 messages need their loaded addresses. */
export function messageForTrace(message: VersionedMessage, loaded?: LoadedAddresses | null): TraceMessage {
  const keys = [
    ...message.staticAccountKeys.map((k) => k.toBase58()),
    ...(loaded?.writable ?? []),
    ...(loaded?.readonly ?? []),
  ]
  const accountKeys = keys.map((pubkey, i) => ({
    pubkey,
    isSigner: message.isAccountSigner(i),
    isWritable: message.isAccountWritable(i),
  }))
  return {
    accountKeys,
    instructions: message.compiledInstructions.map((ix) => ({
      programId: keys[ix.programIdIndex],
      accounts: ix.accountKeyIndexes.map((i) => accountKeys[i]),
      data: new Uint8Array(ix.data),
    })),
  }
}

const innerProgramId = (ix: RpcInnerInstruction, keys: AccountMeta[]) =>
  'programIdIndex' in ix ? keys[ix.programIdIndex]?.pubkey : ix.programId

/** Every program the trace may name, for IDL lookup. */
export function traceProgramIds(input: Pick<TraceInput, 'message' | 'execution'>): string[] {
  const { accountKeys, instructions } = input.message
  const inner = (input.execution.innerInstructions ?? []).flatMap((group) =>
    group.instructions.map((ix) => innerProgramId(ix, accountKeys))
  )
  return [...new Set([...instructions.map((ix) => ix.programId), ...inner])].filter(Boolean)
}

const formatUnits = (value: bigint, decimals: number, signed = false): string => {
  const abs = value < 0n ? -value : value
  const base = 10n ** BigInt(decimals)
  const fraction = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  const sign = value < 0n ? '-' : signed && value > 0n ? '+' : ''
  return `${sign}${abs / base}${fraction ? `.${fraction}` : ''}`
}

const solDeltas = (keys: AccountMeta[], execution: RpcExecution): SolDelta[] | undefined => {
  const { preBalances: pre, postBalances: post } = execution
  if (!pre || !post) return undefined
  const out: SolDelta[] = []
  keys.forEach((key, i) => {
    if (pre[i] === undefined || post[i] === undefined || pre[i] === post[i]) return
    const before = BigInt(pre[i])
    const after = BigInt(post[i])
    out.push({
      account: key.pubkey,
      before: formatUnits(before, 9),
      after: formatUnits(after, 9),
      delta: formatUnits(after - before, 9, true),
    })
  })
  return out
}

const tokenDeltas = (keys: AccountMeta[], execution: RpcExecution): TokenDelta[] | undefined => {
  const { preTokenBalances: pre, postTokenBalances: post } = execution
  if (!pre || !post) return undefined
  // Summed per owner + mint: an owner may hold several accounts of one mint, and accounts may open or close.
  const totals = new Map<string, { owner: string; mint: string; decimals: number; before: bigint; after: bigint }>()
  const add = (balance: RpcTokenBalance, field: 'before' | 'after') => {
    const owner = balance.owner ?? keys[balance.accountIndex]?.pubkey ?? `#${balance.accountIndex}`
    const key = `${owner}:${balance.mint}`
    const total = totals.get(key) ?? {
      owner,
      mint: balance.mint,
      decimals: balance.uiTokenAmount.decimals,
      before: 0n,
      after: 0n,
    }
    total[field] += BigInt(balance.uiTokenAmount.amount)
    totals.set(key, total)
  }
  pre.forEach((b) => add(b, 'before'))
  post.forEach((b) => add(b, 'after'))
  return [...totals.values()]
    .filter((t) => t.before !== t.after)
    .map((t) => ({
      owner: t.owner,
      mint: t.mint,
      decimals: t.decimals,
      before: formatUnits(t.before, t.decimals),
      after: formatUnits(t.after, t.decimals),
      delta: formatUnits(t.after - t.before, t.decimals, true),
    }))
}

const isEventCpi = (data: Uint8Array) => data.length >= 8 && EVENT_CPI_TAG.every((byte, i) => data[i] === byte)

const eventName = (idl: ProgramIdl | undefined, data: Uint8Array): string => {
  if (!idl) return 'event'
  try {
    const path = identifyEventData(idl.root, data.subarray(8), { programAddress: idl.programId })
    const node = path?.[path.length - 1] as EventNode | undefined
    return node ? `event ${pascalCase(node.name)}` : 'event'
  } catch {
    return 'event'
  }
}

const instructionName = (idl: ProgramIdl | undefined, ix: InstructionInput): string | undefined => {
  if (!idl) return undefined
  if (isEventCpi(ix.data)) return eventName(idl, ix.data)
  try {
    return decodeInstruction(idl, ix)?.name
  } catch {
    return undefined
  }
}

const cpiTree = (input: TraceInput, idls: ReadonlyMap<string, ProgramIdl>): CpiEntry[] => {
  const { accountKeys, instructions } = input.message
  const byAddress = new Map(accountKeys.map((k) => [k.pubkey, k]))
  const meta = (address: string) => byAddress.get(address) ?? { pubkey: address, isSigner: false, isWritable: false }

  const cpiEntry = (ix: RpcInnerInstruction, depth: number): CpiEntry => {
    const programId = innerProgramId(ix, accountKeys) ?? '?'
    const idl = idls.get(programId)
    if ('programIdIndex' in ix || ix.data !== undefined) {
      const accounts =
        'programIdIndex' in ix ? ix.accounts.map((i) => accountKeys[i]).filter(Boolean) : (ix.accounts ?? []).map(meta)
      const name = instructionName(idl, { data: bs58.decode(ix.data!), accounts })
      return { programId, program: idl?.name ?? ('program' in ix ? ix.program : undefined), name, depth, children: [] }
    }
    // jsonParsed (simulations): no bytes to decode, but the RPC names the instruction.
    const type = (ix.parsed as { type?: unknown } | undefined)?.type
    return {
      programId,
      program: idl?.name ?? ix.program,
      name: typeof type === 'string' ? type : undefined,
      depth,
      children: [],
    }
  }

  const roots: CpiEntry[] = instructions.map((ix) => {
    const idl = idls.get(ix.programId)
    return { programId: ix.programId, program: idl?.name, name: instructionName(idl, ix), depth: 1, children: [] }
  })
  for (const group of input.execution.innerInstructions ?? []) {
    const root = roots[group.index]
    if (!root) continue
    const stack = [root]
    for (const ix of group.instructions) {
      // Without a stack height (older transactions) every inner instruction hangs off the top-level one.
      const height = ix.stackHeight ?? 2
      while (stack.length > 1 && stack.length >= height) stack.pop()
      const parent = stack[stack.length - 1]
      const entry = cpiEntry(ix, parent.depth + 1)
      parent.children.push(entry)
      stack.push(entry)
    }
  }
  return roots
}

const CUSTOM_ERROR_LOG = /^Program (\S+) failed: custom program error: 0x([0-9a-fA-F]+)$/
const ANCHOR_ERROR_LOG = /Error Code: (\w+)\. Error Number: (\d+)\. Error Message: (.*?)\.?$/

const programError = (idl: ProgramIdl | undefined, code: number) => {
  const node = (idl?.root.program.errors ?? []).find((e) => e.code === code)
  if (!node) return undefined
  const idlName = (node as { idlName?: unknown }).idlName
  return { name: typeof idlName === 'string' ? idlName : pascalCase(node.name), message: node.message }
}

const customError = (
  index: number,
  code: number,
  raw: string,
  input: TraceInput,
  logs: string[],
  idls: ReadonlyMap<string, ProgramIdl>
): TraceError => {
  // A CPI's error surfaces on the top-level instruction; the first "failed" log names the program that raised it.
  const failed = logs.map((line) => CUSTOM_ERROR_LOG.exec(line)).find((m) => m && parseInt(m[2], 16) === code)
  const programId = failed?.[1] ?? input.message.instructions[index]?.programId
  const anchor = logs.map((line) => ANCHOR_ERROR_LOG.exec(line)).find((m) => m && Number(m[2]) === code)
  const known = programError(programId ? idls.get(programId) : undefined, code) ?? {
    name: anchor?.[1],
    message: anchor?.[3],
  }
  return { instructionIndex: index, raw, programId, code, ...known }
}

const traceError = (
  input: TraceInput,
  logs: string[],
  idls: ReadonlyMap<string, ProgramIdl>
): TraceError | undefined => {
  const err = input.execution.err
  if (err === null || err === undefined) return undefined
  const raw = typeof err === 'string' ? err : JSON.stringify(err)
  if (typeof err !== 'object') return { raw, name: String(err) }
  const [kind] = Object.keys(err)
  const instructionError = (err as { InstructionError?: unknown }).InstructionError
  if (!Array.isArray(instructionError)) return { raw, name: kind }
  const [index, detail] = instructionError as [number, unknown]
  if (typeof detail === 'string') return { instructionIndex: index, raw, name: detail }
  const custom = (detail as { Custom?: unknown } | null)?.Custom
  if (typeof custom === 'number') return customError(index, custom, raw, input, logs, idls)
  return { instructionIndex: index, raw, name: detail ? Object.keys(detail)[0] : undefined }
}

/** Builds the trace of a fetched or simulated transaction; `idls` (by program id) name instructions and errors. */
export function buildTrace(input: TraceInput, idls: ReadonlyMap<string, ProgramIdl>): TxTrace {
  const { execution } = input
  const logs = execution.logMessages ?? execution.logs ?? []
  const error = traceError(input, logs, idls)
  const computeUnits = execution.computeUnitsConsumed ?? execution.unitsConsumed
  return {
    status: error ? 'failed' : 'success',
    error,
    fee: typeof execution.fee === 'number' ? String(execution.fee) : undefined,
    computeUnits: computeUnits ?? undefined,
    solDeltas: solDeltas(input.message.accountKeys, execution),
    tokenDeltas: tokenDeltas(input.message.accountKeys, execution),
    cpiTree: cpiTree(input, idls),
    logs,
    simulated: input.simulated ? { slot: input.slot } : undefined,
  }
}
