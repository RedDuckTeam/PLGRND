// Converts between the values Codama codecs produce/accept and what node data can hold (plain JSON, no bigint),
// guided by the IDL type. `formatValue` gives the string an inline field shows; `parseValue` accepts that string
// back, or a value from an edge (TEXT/NUMBER/… outputs), and returns a codec value.
import { Buffer } from 'buffer'
import { pascalCase, type RootNode, type TypeNode } from '@codama/nodes'

type Plain = null | boolean | number | string | Plain[] | { [key: string]: Plain }

const BIG_INTEGERS = new Set(['u64', 'i64', 'u128', 'i128'])
const FLOATS = new Set(['f32', 'f64'])

export class ValueError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValueError'
  }
}

/** Follows wrappers and defined-type links to the node that decides the value's shape. */
export function resolveType(type: TypeNode, root: RootNode): TypeNode {
  let node = type
  for (let depth = 0; depth < 64; depth++) {
    switch (node.kind) {
      case 'fixedSizeTypeNode':
      case 'sizePrefixTypeNode':
      case 'sentinelTypeNode':
      case 'hiddenPrefixTypeNode':
      case 'hiddenSuffixTypeNode':
      case 'preOffsetTypeNode':
      case 'postOffsetTypeNode':
        node = node.type
        break
      case 'amountTypeNode':
      case 'solAmountTypeNode':
      case 'dateTimeTypeNode':
        node = node.number
        break
      case 'definedTypeLinkNode': {
        const name = node.name
        const defined = (root.program.definedTypes ?? []).find((t) => t.name === name)
        if (!defined) throw new ValueError(`Unknown type ${name}`)
        node = defined.type
        break
      }
      default:
        return node
    }
  }
  throw new ValueError('Type nesting too deep')
}

const isScalar = (type: TypeNode) =>
  ['numberTypeNode', 'booleanTypeNode', 'stringTypeNode', 'publicKeyTypeNode', 'bytesTypeNode'].includes(type.kind)

const isOption = (value: unknown): value is { __option: 'Some' | 'None'; value?: unknown } =>
  typeof value === 'object' && value !== null && '__option' in value

const enumVariants = (type: Extract<TypeNode, { kind: 'enumTypeNode' }>) => type.variants ?? []

export function toPlain(value: unknown, type: TypeNode, root: RootNode): Plain {
  const t = resolveType(type, root)
  switch (t.kind) {
    case 'numberTypeNode':
      return typeof value === 'bigint' ? value.toString() : (value as number)
    case 'booleanTypeNode':
    case 'stringTypeNode':
    case 'publicKeyTypeNode':
      return value as Plain
    case 'bytesTypeNode': {
      const [encoding, data] = value as [string, string]
      return encoding === 'base16' ? data : Buffer.from(data, encoding === 'utf8' ? 'utf8' : 'base64').toString('hex')
    }
    case 'arrayTypeNode':
    case 'setTypeNode':
      return (value as unknown[]).map((item) => toPlain(item, t.item, root))
    case 'tupleTypeNode':
      return (value as unknown[]).map((item, i) => toPlain(item, (t.items ?? [])[i], root))
    case 'structTypeNode': {
      const out: Record<string, Plain> = {}
      const record = value as Record<string, unknown>
      for (const field of t.fields ?? []) out[field.name] = toPlain(record[field.name], field.type, root)
      return out
    }
    case 'mapTypeNode': {
      // dynamic-codecs maps are plain objects keyed by the key's string form.
      const entries = value instanceof Map ? [...value.entries()] : Object.entries(value as object)
      return Object.fromEntries(entries.map(([k, v]) => [String(k), toPlain(v, t.value, root)]))
    }
    case 'optionTypeNode':
    case 'zeroableOptionTypeNode':
    case 'remainderOptionTypeNode': {
      if (isOption(value)) return value.__option === 'None' ? null : toPlain(value.value, t.item, root)
      return value === null || value === undefined ? null : toPlain(value, t.item, root)
    }
    case 'enumTypeNode': {
      const { __kind: kind, ...rest } = value as { __kind: string; __discriminator?: unknown } & Record<string, unknown>
      const variant = enumVariants(t).find((v) => pascalCase(v.name) === kind)
      if (!variant) throw new ValueError(`Unknown enum variant ${kind}`)
      if (variant.kind === 'enumEmptyVariantTypeNode')
        return enumVariants(t).every((v) => v.kind === 'enumEmptyVariantTypeNode') ? kind : { __kind: kind }
      if (variant.kind === 'enumStructVariantTypeNode') {
        const fields = toPlain(rest, variant.struct, root) as Record<string, Plain>
        return { __kind: kind, ...fields }
      }
      return { __kind: kind, fields: toPlain((rest as { fields: unknown }).fields, variant.tuple, root) }
    }
    default:
      throw new ValueError(`Unsupported type ${t.kind}`)
  }
}

const integer = (input: unknown, big: boolean): bigint | number => {
  if (typeof input === 'bigint') return big ? input : Number(input)
  const text = typeof input === 'number' ? String(input) : typeof input === 'string' ? input.trim() : ''
  if (!/^-?\d+$/.test(text)) throw new ValueError(`Expected an integer, got ${JSON.stringify(input)}`)
  if (big) return BigInt(text)
  const n = Number(text)
  if (!Number.isSafeInteger(n)) throw new ValueError(`Integer out of range: ${text}`)
  return n
}

export function fromPlain(input: unknown, type: TypeNode, root: RootNode): unknown {
  const t = resolveType(type, root)
  switch (t.kind) {
    case 'numberTypeNode': {
      if (FLOATS.has(t.format)) {
        const n = typeof input === 'string' ? Number(input.trim()) : Number(input)
        if (!Number.isFinite(n)) throw new ValueError(`Expected a number, got ${JSON.stringify(input)}`)
        return n
      }
      return integer(input, BIG_INTEGERS.has(t.format))
    }
    case 'booleanTypeNode':
      if (input === true || input === 'true' || input === 1) return true
      if (input === false || input === 'false' || input === 0) return false
      throw new ValueError(`Expected a boolean, got ${JSON.stringify(input)}`)
    case 'stringTypeNode':
    case 'publicKeyTypeNode':
      if (typeof input !== 'string') throw new ValueError(`Expected a string, got ${JSON.stringify(input)}`)
      return t.kind === 'publicKeyTypeNode' ? input.trim() : input
    case 'bytesTypeNode': {
      if (Array.isArray(input) && input.length === 2 && typeof input[0] === 'string' && typeof input[1] === 'string') {
        return input
      }
      if (input instanceof Uint8Array) return ['base16', Buffer.from(input).toString('hex')]
      const hex = typeof input === 'string' ? input.trim().replace(/^0x/, '') : ''
      if (!/^([0-9a-fA-F]{2})*$/.test(hex)) throw new ValueError(`Expected hex bytes, got ${JSON.stringify(input)}`)
      return ['base16', hex.toLowerCase()]
    }
    case 'arrayTypeNode':
    case 'setTypeNode':
      if (!Array.isArray(input)) throw new ValueError(`Expected an array, got ${JSON.stringify(input)}`)
      return input.map((item) => fromPlain(item, t.item, root))
    case 'tupleTypeNode': {
      const items = t.items ?? []
      if (!Array.isArray(input) || input.length !== items.length) {
        throw new ValueError(`Expected a ${items.length}-tuple, got ${JSON.stringify(input)}`)
      }
      return input.map((item, i) => fromPlain(item, items[i], root))
    }
    case 'structTypeNode': {
      if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        throw new ValueError(`Expected an object, got ${JSON.stringify(input)}`)
      }
      const record = input as Record<string, unknown>
      return Object.fromEntries(
        (t.fields ?? []).map((field) => [field.name, fromPlain(record[field.name], field.type, root)])
      )
    }
    case 'mapTypeNode': {
      if (typeof input !== 'object' || input === null) {
        throw new ValueError(`Expected an object, got ${JSON.stringify(input)}`)
      }
      const entries = Array.isArray(input) ? (input as [unknown, unknown][]) : Object.entries(input)
      return Object.fromEntries(entries.map(([k, v]) => [String(k), fromPlain(v, t.value, root)]))
    }
    case 'optionTypeNode':
    case 'zeroableOptionTypeNode':
    case 'remainderOptionTypeNode':
      if (isOption(input)) {
        return input.__option === 'None' ? input : { __option: 'Some', value: fromPlain(input.value, t.item, root) }
      }
      if (input === null || input === undefined) return { __option: 'None' }
      return { __option: 'Some', value: fromPlain(input, t.item, root) }
    case 'enumTypeNode': {
      const plain = typeof input === 'string' ? { __kind: input } : (input as Record<string, unknown> | null)
      const kind = plain?.__kind
      const variant = enumVariants(t).find((v) => pascalCase(v.name) === kind || v.name === kind)
      if (!plain || !variant) throw new ValueError(`Unknown enum variant ${JSON.stringify(input)}`)
      const out = { __kind: pascalCase(variant.name) }
      if (variant.kind === 'enumEmptyVariantTypeNode') return out
      if (variant.kind === 'enumStructVariantTypeNode') {
        return { ...out, ...(fromPlain(plain, variant.struct, root) as object) }
      }
      return { ...out, fields: fromPlain(plain.fields, variant.tuple, root) }
    }
    default:
      throw new ValueError(`Unsupported type ${t.kind}`)
  }
}

/** The string an inline field shows: scalars as text, everything else as JSON with bigints as strings and bytes as hex. */
export function formatValue(value: unknown, type: TypeNode, root: RootNode): string {
  const plain = toPlain(value, type, root)
  return isScalar(resolveType(type, root)) ? String(plain) : JSON.stringify(plain)
}

/** Parses an inline string (formatValue's output or user input) or an edge value into a codec value. */
export function parseValue(input: unknown, type: TypeNode, root: RootNode): unknown {
  const t = resolveType(type, root)
  if (typeof input !== 'string' || isScalar(t)) return fromPlain(input, type, root)
  let json: unknown
  try {
    json = JSON.parse(input)
  } catch {
    // An option of a scalar may be typed plainly, e.g. a pubkey for Option<Pubkey>.
    if (t.kind === 'optionTypeNode' || t.kind === 'zeroableOptionTypeNode' || t.kind === 'remainderOptionTypeNode') {
      return { __option: 'Some', value: parseValue(input, t.item, root) }
    }
    if (t.kind === 'enumTypeNode') return fromPlain(input, type, root)
    throw new ValueError(`Invalid JSON: ${input}`)
  }
  return fromPlain(json, type, root)
}
