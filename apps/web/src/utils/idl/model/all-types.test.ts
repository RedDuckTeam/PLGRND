import fs from 'node:fs'
import path from 'node:path'
import { pascalCase, type RootNode, type TypeNode } from '@codama/nodes'
import { getNodeCodec } from '@codama/dynamic-codecs'
import { PublicKey } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'
import { FIXTURES_DIR } from '@/__fixtures__/tx-helpers'
import { decodeInstruction } from './codec'
import { normalizeIdl } from './normalize'
import { instructionNode, type ProgramIdl } from './program-idl'
import { resolveType } from './values'

const PROGRAM_ID = new PublicKey(new Uint8Array(32).fill(42)).toBase58()
const key = (n: number) => new PublicKey(new Uint8Array(32).fill(n)).toBase58()

const INTEGERS: Record<string, number | bigint> = {
  u8: 200,
  i8: -5,
  u16: 60_000,
  i16: -300,
  u32: 4_000_000_000,
  i32: -2_000_000_000,
  u64: 2n ** 63n + 7n,
  i64: -(2n ** 62n),
  u128: 2n ** 64n + 5n,
  i128: -(2n ** 70n),
  shortU16: 300,
}

/** A non-trivial value for every type, so a round trip exercises sign, width, nesting and prefixes. */
function sample(type: TypeNode, root: RootNode, depth = 0): unknown {
  const t = resolveType(type, root)
  switch (t.kind) {
    case 'numberTypeNode':
      return t.format === 'f32' ? 1.5 : t.format === 'f64' ? -2.25 : INTEGERS[t.format]
    case 'booleanTypeNode':
      return true
    case 'stringTypeNode':
      return 'héllo'
    case 'publicKeyTypeNode':
      return key(7)
    case 'bytesTypeNode':
      return ['base16', '0a0bff']
    case 'arrayTypeNode':
    case 'setTypeNode': {
      const count = t.count.kind === 'fixedCountNode' ? t.count.value : 2
      return Array.from({ length: count }, () => sample(t.item, root, depth + 1))
    }
    case 'tupleTypeNode':
      return (t.items ?? []).map((item) => sample(item, root, depth + 1))
    case 'structTypeNode':
      return Object.fromEntries((t.fields ?? []).map((f) => [f.name, sample(f.type, root, depth + 1)]))
    case 'mapTypeNode':
      return { [String(sample(t.key, root, depth + 1))]: sample(t.value, root, depth + 1) }
    case 'optionTypeNode':
    case 'zeroableOptionTypeNode':
    case 'remainderOptionTypeNode':
      return { __option: 'Some', value: sample(t.item, root, depth + 1) }
    case 'enumTypeNode': {
      const variant = (t.variants ?? [])[(t.variants ?? []).length - 1]
      const kind = pascalCase(variant.name)
      if (variant.kind === 'enumStructVariantTypeNode')
        return { __kind: kind, ...(sample(variant.struct, root) as object) }
      if (variant.kind === 'enumTupleVariantTypeNode') return { __kind: kind, fields: sample(variant.tuple, root) }
      return { __kind: kind }
    }
    default:
      throw new Error(`no sample for ${t.kind}`)
  }
}

const loadIdl = (file: string) =>
  normalizeIdl(JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'idl', file), 'utf8')), PROGRAM_ID)

/** Encodes an instruction straight through the Codama codec, bypassing values.ts, with sample values. */
const encodeSample = (idl: ProgramIdl, name: string, overrides: Record<string, unknown> = {}) => {
  const summary = idl.instructions.find((s) => s.name === name)!
  const node = instructionNode(idl, summary)
  const values: Record<string, unknown> = {}
  for (const arg of node.arguments ?? []) {
    const dv = arg.defaultValue
    values[arg.name] =
      arg.defaultValueStrategy === 'omitted' && dv?.kind === 'bytesValueNode'
        ? [dv.encoding, dv.data]
        : arg.defaultValueStrategy === 'omitted' && dv?.kind === 'numberValueNode'
          ? dv.number
          : (overrides[arg.name] ?? sample(arg.type, idl.root))
  }
  const data = new Uint8Array(getNodeCodec([idl.root, idl.root.program, node] as never).encode(values))
  const accounts = summary.accounts.map((a, i) => ({
    pubkey: key(i + 1),
    isSigner: a.isSigner === true,
    isWritable: a.isWritable,
  }))
  return { summary, node, data, accounts }
}

const FILES = [
  'all-types.codama.json',
  'all-types.anchor-v01.json',
  'all-types.anchor-legacy.json',
  'all-types.shank.json',
]

describe('all-types IDLs', () => {
  it.each(FILES)('%s: every instruction survives decode → inline strings → encode', (file) => {
    const idl = loadIdl(file)
    expect(idl.instructions.length).toBeGreaterThan(0)
    for (const { name } of idl.instructions) {
      const { data, accounts } = encodeSample(idl, name)
      const decoded = decodeInstruction(idl, { data, accounts })
      expect(decoded, `${file} ${name}`).not.toBeNull()
      expect(decoded!.name).toBe(name)
      expect(decoded!.exact, `${file} ${name} ${JSON.stringify(decoded!.args)}`).toBe(true)
      expect(JSON.stringify(decoded!.args)).not.toMatch(/\d+n\b/)
    }
  })

  it('formats 128-bit and negative integers as decimal strings', () => {
    const idl = loadIdl('all-types.codama.json')
    const { data, accounts } = encodeSample(idl, 'initialize')
    const decoded = decodeInstruction(idl, { data, accounts })!
    expect(decoded.args.valueU128).toBe((2n ** 64n + 5n).toString())
    expect(decoded.args.valueI128).toBe((-(2n ** 70n)).toString())
    expect(decoded.args.valueF32).toBe('1.5')
  })

  it('labels accounts by guess when a Shank instruction omits an optional account', () => {
    const idl = loadIdl('all-types.shank.json')
    const { data, accounts, summary } = encodeSample(idl, 'Initialize')
    const omitted = summary.accounts.findIndex((a) => a.isOptional)
    const decoded = decodeInstruction(idl, { data, accounts: accounts.filter((_, i) => i !== omitted) })!
    expect(decoded.exact).toBe(true)
    // Positions after the missing account shift, so every name is only a guess.
    expect(decoded.accounts.map((a) => a.name)).toEqual([
      '#0 (payer?)',
      '#1 (state?)',
      '#2 (authority?)',
      '#3 (systemProgram?)',
    ])
  })

  // Find where a scalar argument sits by encoding two values and diffing the bytes.
  const offsetOf = (idl: ProgramIdl, name: string, arg: string, a: unknown, b: unknown) => {
    const x = encodeSample(idl, name, { [arg]: a }).data
    const y = encodeSample(idl, name, { [arg]: b }).data
    return x.findIndex((byte, i) => byte !== y[i])
  }

  it('never claims an exact decode for a bool byte other than 0 or 1', () => {
    const idl = loadIdl('all-types.codama.json')
    const at = offsetOf(idl, 'initialize', 'valueBool', true, false)
    const { data, accounts } = encodeSample(idl, 'initialize')
    data[at] = 2
    const decoded = decodeInstruction(idl, { data, accounts })
    expect(decoded === null || !decoded.exact).toBe(true)
  })

  it('never claims an exact decode for invalid UTF-8', () => {
    const idl = loadIdl('all-types.codama.json')
    const at = offsetOf(idl, 'initialize', 'valueString', 'aaaaaa', 'bbbbbb')
    const { data, accounts } = encodeSample(idl, 'initialize', { valueString: 'aaaaaa' })
    data[at] = 0xff
    const decoded = decodeInstruction(idl, { data, accounts })
    expect(decoded === null || !decoded.exact).toBe(true)
  })
})
