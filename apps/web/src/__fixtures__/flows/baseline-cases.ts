import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Edge, Node } from '@xyflow/react'

export const FLOWS_DIR = path.dirname(fileURLToPath(import.meta.url))

/** WALLET nodes resolve to this key in the baseline (Keypair.fromSeed(32 × 7)). */
export const BASELINE_WALLET = 'GmaDrppBC7P5ARKV8g3djiwP89vz1jLK23V2GBjuAEGB'

export interface FlowFixture {
  nodes: Node[]
  edges: Edge[]
}

export interface BaselineCase {
  name: string
  file: string
  /** The PROGRAM_INSTRUCTIONS selection to switch to, for variants of one flow. */
  selectInstruction?: string
}

export const BASELINE_CASES: BaselineCase[] = [
  { name: 'example-4-transfer', file: 'example-4-transfer.json' },
  { name: 'example-5-counter-increment', file: 'example-5-counter.json' },
  { name: 'example-5-counter-initialize', file: 'example-5-counter.json', selectInstruction: 'initialize' },
  { name: 'example-5-counter-decrement', file: 'example-5-counter.json', selectInstruction: 'decrement' },
  { name: 'kit-compute-budget', file: 'kit-compute-budget.json' },
  { name: 'solana-transfer-priority-fee', file: 'solana-transfer-priority-fee.json' },
  { name: 'solanamobile-counter', file: 'solanamobile-counter.json' },
]

export const loadCaseFlow = (c: BaselineCase): FlowFixture => {
  const flow = JSON.parse(fs.readFileSync(path.join(FLOWS_DIR, c.file), 'utf8')) as FlowFixture
  if (!c.selectInstruction) return flow
  return {
    ...flow,
    nodes: flow.nodes.map((n) =>
      n.type === 'PROGRAM_INSTRUCTIONS' ? { ...n, data: { ...n.data, selectedInstruction: c.selectInstruction } } : n
    ),
  }
}
