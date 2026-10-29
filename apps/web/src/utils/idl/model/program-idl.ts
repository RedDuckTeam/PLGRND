import type { InstructionNode, RootNode, TypeNode } from '@codama/nodes'
import type { IdlFormat } from '../format'

export interface IdlAccountMetaSummary {
  /** Name as written in the source IDL; persisted handle ids and selections use it. */
  name: string
  codamaName: string
  isSigner: boolean | 'either'
  isWritable: boolean
  isOptional: boolean
  /** Fixed address from the IDL (e.g. the system program), when it has one. */
  defaultAddress?: string
}

export interface IdlArgSummary {
  name: string
  codamaName: string
  type: TypeNode
}

export interface IdlInstructionSummary {
  name: string
  codamaName: string
  accounts: IdlAccountMetaSummary[]
  /** User-facing arguments; discriminators and other omitted-with-default arguments are excluded. */
  args: IdlArgSummary[]
}

export interface IdlAccountSummary {
  name: string
  codamaName: string
  /** Data fields, source name ⇄ Codama name (PROGRAM_ACCOUNT exposes them as `field_<name>` handles). */
  fields: { name: string; codamaName: string }[]
}

/** An IDL of any supported format, normalized to a Codama root. Plain JSON, recomputed at runtime, never persisted. */
export interface ProgramIdl {
  kind: 'plgrnd-idl/1'
  format: IdlFormat
  programId: string
  name: string
  root: RootNode
  instructions: IdlInstructionSummary[]
  accounts: IdlAccountSummary[]
  /** Converter notices, e.g. renamed PDA collisions. */
  warnings: string[]
}

export const findInstruction = (idl: ProgramIdl, name: string): IdlInstructionSummary | undefined =>
  idl.instructions.find((ix) => ix.name === name)

export const instructionNode = (idl: ProgramIdl, summary: IdlInstructionSummary): InstructionNode =>
  (idl.root.program.instructions ?? []).find((ix) => ix.name === summary.codamaName)!
