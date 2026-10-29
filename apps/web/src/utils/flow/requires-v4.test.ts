import type { Edge, Node } from '@xyflow/react'
import LZString from 'lz-string'
import { describe, expect, it } from 'vitest'
import { Transaction } from '@solana/web3.js'
import counterIdl from '@/constants/programs/counter/counter.json'
import { EXAMPLE_FLOWS } from '@/constants/example-flows'
import { sanitizeNodes } from '@/stores/flow-snapshot'
import { BASELINE_CASES, loadCaseFlow } from '@/__fixtures__/flows/baseline-cases'
import { decodeFlowFromHash, encodeFlowToHash } from './share'
import { requiresV4 } from './requires-v4'

const fromShareUrl = (url: string) =>
  JSON.parse(LZString.decompressFromEncodedURIComponent(url.replace('#flow=', ''))) as { nodes: Node[]; edges: Edge[] }

const realFlows: [string, { nodes: Node[]; edges: Edge[] }][] = [
  ...EXAMPLE_FLOWS.map((e) => [e.title, fromShareUrl(e.shareUrl)] as [string, { nodes: Node[]; edges: Edge[] }]),
  ...['kit-compute-budget', 'solana-transfer-priority-fee', 'solanamobile-counter'].map(
    (name) =>
      [name, loadCaseFlow(BASELINE_CASES.find((c) => c.name === name)!)] as [string, { nodes: Node[]; edges: Edge[] }]
  ),
]

const sanitized = (flow: { nodes: Node[]; edges: Edge[] }) => ({ nodes: sanitizeNodes(flow.nodes), edges: flow.edges })
const versionOf = (flow: { nodes: Node[]; edges: Edge[] }) =>
  JSON.parse(LZString.decompressFromEncodedURIComponent(encodeFlowToHash(flow))).v as number

// A counter flow built by hand today: a pasted legacy IDL, a fresh IDL node's autoLoad flag, one instruction.
const handBuilt = (): { nodes: Node[]; edges: Edge[] } => ({
  nodes: [
    {
      id: 'idl',
      type: 'IDL',
      position: { x: 0, y: 0 },
      data: { idlJson: JSON.stringify(counterIdl), programId: '', autoLoad: true },
    },
    { id: 'b', type: 'TRANSACTION_BUILDER', position: { x: 0, y: 0 }, data: {} },
    { id: 'pi', type: 'PROGRAM_INSTRUCTIONS', position: { x: 0, y: 0 }, data: { selectedInstruction: 'increment' } },
  ],
  edges: [
    { id: 'e1', source: 'idl', sourceHandle: 'idl-idl-right', target: 'pi', targetHandle: 'pi-idl-left' },
    { id: 'e2', source: 'b', sourceHandle: 'b-transaction-right', target: 'pi', targetHandle: 'pi-transactionIn-left' },
  ],
})

const withIdl = (patch: Record<string, unknown>) => {
  const flow = handBuilt()
  flow.nodes[0] = { ...flow.nodes[0], data: { ...flow.nodes[0].data, ...patch } }
  return flow
}

// A RAW_INSTRUCTION node as the canvas holds it, including its recomputed outputs.
const rawNode = (): Node => ({
  id: 'r',
  type: 'RAW_INSTRUCTION',
  position: { x: 0, y: 0 },
  data: {
    programId: '11111111111111111111111111111111',
    accounts: [{ pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: true }],
    dataHex: '02000000',
    annotations: { instruction: 'transfer', reason: 'IDL changed' },
    transactionOut: new Transaction(),
    error: null,
  },
})

describe('requiresV4', () => {
  it.each(realFlows)('%s stays version 3', (_, flow) => {
    expect(requiresV4(sanitized(flow))).toBe(false)
    expect(versionOf(flow)).toBe(3)
  })

  it('keeps a new hand-built counter flow with a pasted legacy IDL at version 3', () => {
    expect(versionOf(handBuilt())).toBe(3)
  })

  it.each([
    [
      'an unknown node type',
      () => ({
        ...handBuilt(),
        nodes: [...handBuilt().nodes, { id: 'r', type: 'RAW_INSTRUCTION', position: { x: 0, y: 0 }, data: {} }],
      }),
    ],
    [
      'a RAW_INSTRUCTION node',
      () => ({
        ...handBuilt(),
        nodes: [...handBuilt().nodes, rawNode()],
        edges: [
          ...handBuilt().edges,
          {
            id: 'e3',
            source: 'pi',
            sourceHandle: 'pi-transactionOut-right',
            target: 'r',
            targetHandle: 'r-transactionIn-left',
          },
        ],
      }),
    ],
    [
      'an IDL loaded by reference',
      () =>
        withIdl({
          idlJson: undefined,
          ref: { programId: 'x', network: 'MAINNET', source: 'anchor', format: 'anchor', contentHash: 'h' },
        }),
    ],
    ['a Codama IDL', () => withIdl({ idlJson: JSON.stringify({ kind: 'rootNode', program: {} }) })],
    [
      'a Shank IDL',
      () =>
        withIdl({
          idlJson: JSON.stringify({
            instructions: [{ name: 'a', discriminant: { type: 'u8', value: 0 } }],
            metadata: { origin: 'shank' },
          }),
        }),
    ],
    [
      'an Anchor 0.30+ IDL',
      () => withIdl({ idlJson: JSON.stringify({ address: 'x', metadata: { spec: '0.1.0' }, instructions: [] }) }),
    ],
    [
      'inline values',
      () => ({
        ...handBuilt(),
        nodes: handBuilt().nodes.map((n) =>
          n.id === 'pi' ? { ...n, data: { ...n.data, inline: { arg_amount: '1' } } } : n
        ),
      }),
    ],
    [
      'original account metas',
      () => ({
        ...handBuilt(),
        nodes: handBuilt().nodes.map((n) => (n.id === 'pi' ? { ...n, data: { ...n.data, metaOverrides: [] } } : n)),
      }),
    ],
    [
      'remaining accounts',
      () => ({
        ...handBuilt(),
        nodes: handBuilt().nodes.map((n) => (n.id === 'pi' ? { ...n, data: { ...n.data, remainingAccounts: [] } } : n)),
      }),
    ],
    [
      'transaction draft data',
      () => ({
        ...handBuilt(),
        nodes: handBuilt().nodes.map((n) => (n.id === 'b' ? { ...n, data: { version: 0 } } : n)),
      }),
    ],
    [
      'an edge into the IDL network handle',
      () => ({
        ...handBuilt(),
        edges: [
          ...handBuilt().edges,
          {
            id: 'e3',
            source: 'b',
            sourceHandle: 'b-transaction-right',
            target: 'idl',
            targetHandle: 'idl-network-left',
          },
        ],
      }),
    ],
  ])('writes version 4 for %s', (_, make) => {
    expect(requiresV4(sanitized(make()))).toBe(true)
    expect(versionOf(make())).toBe(4)
  })
})

describe('RAW_INSTRUCTION snapshots', () => {
  it('drop the recomputed transaction and error and keep the instruction', () => {
    const [sanitized] = sanitizeNodes([rawNode()])
    expect(Object.keys(sanitized.data).sort()).toEqual(['accounts', 'annotations', 'dataHex', 'programId'])
    expect(requiresV4({ nodes: [sanitized], edges: [] })).toBe(true)
  })
})

describe('shared snapshots', () => {
  it.each(realFlows)('%s round-trips unchanged except transient data', (_, flow) => {
    const decoded = decodeFlowFromHash(encodeFlowToHash(flow))!
    // Exactly these keys are recomputed at runtime; everything else must survive untouched.
    const transient: Record<string, (key: string) => boolean> = {
      IDL: (k) => k === 'idl',
      PROGRAM_INSTRUCTIONS: (k) => k === 'idl' || k === 'transactionOut',
      PROGRAM_ACCOUNT: (k) => ['idl', 'decoded', 'error'].includes(k) || k.startsWith('field_'),
    }
    const expected = flow.nodes.map((n) => ({
      ...n,
      data: Object.fromEntries(Object.entries(n.data).filter(([k]) => !transient[n.type ?? '']?.(k))),
    }))
    expect(decoded.nodes.map((n) => ({ ...n, selected: undefined }))).toEqual(
      expected.map((n) => ({ ...n, selected: undefined }))
    )
    expect(decoded.edges.map((e) => ({ ...e, selected: undefined }))).toEqual(
      flow.edges.map((e) => ({ ...e, selected: undefined }))
    )
  })
})
