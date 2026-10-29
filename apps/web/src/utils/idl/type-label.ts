// Readable labels and handle data types for Codama type nodes. Type-only Codama imports, so node components on the
// editor's initial path can use it without loading the converter.
import type { TypeNode } from '@codama/nodes'

const NUMBER_FORMATS = new Set(['u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128', 'f32', 'f64'])

/** e.g. `u64`, `pubkey`, `vec<u8>`, `[u8; 32]`, `option<pubkey>`, or a defined type's name. */
export function typeLabel(type: TypeNode): string {
  switch (type.kind) {
    case 'numberTypeNode':
      return type.format
    case 'booleanTypeNode':
      return 'bool'
    case 'stringTypeNode':
      return 'string'
    case 'publicKeyTypeNode':
      return 'pubkey'
    case 'bytesTypeNode':
      return 'bytes'
    case 'fixedSizeTypeNode':
      return type.type.kind === 'bytesTypeNode' ? `[u8; ${type.size}]` : typeLabel(type.type)
    case 'sizePrefixTypeNode':
    case 'sentinelTypeNode':
    case 'hiddenPrefixTypeNode':
    case 'hiddenSuffixTypeNode':
    case 'preOffsetTypeNode':
    case 'postOffsetTypeNode':
      return typeLabel(type.type)
    case 'amountTypeNode':
    case 'solAmountTypeNode':
    case 'dateTimeTypeNode':
      return typeLabel(type.number)
    case 'arrayTypeNode':
      if (type.count.kind === 'fixedCountNode') return `[${typeLabel(type.item)}; ${type.count.value}]`
      return `vec<${typeLabel(type.item)}>`
    case 'setTypeNode':
      return `set<${typeLabel(type.item)}>`
    case 'mapTypeNode':
      return `map<${typeLabel(type.key)}, ${typeLabel(type.value)}>`
    case 'tupleTypeNode':
      return `(${(type.items ?? []).map(typeLabel).join(', ')})`
    case 'optionTypeNode':
    case 'zeroableOptionTypeNode':
    case 'remainderOptionTypeNode':
      return `option<${typeLabel(type.item)}>`
    case 'definedTypeLinkNode':
      return type.name
    case 'structTypeNode':
      return 'struct'
    case 'enumTypeNode':
      return 'enum'
    default:
      return (type as { kind: string }).kind.replace(/TypeNode$/, '')
  }
}

/** The handle data type an account field of this type is offered as (same mapping as the legacy decoder). */
export function handleDataType(type: TypeNode): string {
  switch (type.kind) {
    case 'numberTypeNode':
      return NUMBER_FORMATS.has(type.format) ? 'number' : 'any'
    case 'stringTypeNode':
    case 'bytesTypeNode':
      return 'text'
    case 'publicKeyTypeNode':
      return 'publicKey'
    case 'fixedSizeTypeNode':
    case 'sizePrefixTypeNode':
      return handleDataType(type.type)
    case 'amountTypeNode':
    case 'solAmountTypeNode':
    case 'dateTimeTypeNode':
      return handleDataType(type.number)
    default:
      return 'any'
  }
}
