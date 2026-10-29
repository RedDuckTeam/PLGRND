import type { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { createFlowStore } from '@/stores/flow-store'
import { swapSignerForWallet } from './swap-signer'

const node = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({
  id,
  type,
  position: { x: 1, y: 2 },
  data,
})
const edge = (source: string, sourceField: string, target: string, targetField: string): Edge => ({
  id: `${source}-${target}-${targetField}`,
  source,
  sourceHandle: `${source}-${sourceField}-right`,
  target,
  targetHandle: `${target}-${targetField}-left`,
})

describe('swapSignerForWallet', () => {
  const nodes = [
    node('signer', 'TEXT', { text: 'Pubkey111', signer: true }),
    node('b', 'TRANSACTION_BUILDER'),
    node('pi', 'PROGRAM_INSTRUCTIONS'),
    node('tx', 'TRANSACTION'),
  ]
  const edges = [edge('signer', 'text', 'b', 'feePayer'), edge('signer', 'text', 'pi', 'account_user')]

  it('rewires every edge of the signer to the wallet public key and signs the fee payer with the wallet', () => {
    const out = swapSignerForWallet(nodes, edges, 'signer', 'w')
    expect(out.nodes.map((n) => n.id)).toEqual(['b', 'pi', 'tx', 'w'])
    expect(out.nodes.find((n) => n.id === 'w')).toMatchObject({ type: 'WALLET', position: { x: 1, y: 2 } })
    expect(out.edges.map((e) => [e.sourceHandle, e.targetHandle])).toEqual([
      ['w-publicKey-right', 'b-feePayer-left'],
      ['w-publicKey-right', 'pi-account_user-left'],
      ['w-wallet-right', 'tx-privateKey-left'],
    ])
  })

  it('leaves an already signed transaction alone', () => {
    const signed = [...edges, edge('key', 'privateKey', 'tx', 'privateKey')]
    const out = swapSignerForWallet([...nodes, node('key', 'PRIVATE_KEY')], signed, 'signer', 'w')
    expect(out.edges.filter((e) => e.target === 'tx')).toHaveLength(1)
  })
})

describe('flow store generation', () => {
  it('changes whenever the whole flow is replaced, so the canvas renders the new flow on fresh node components', () => {
    const store = createFlowStore()
    const before = store.getState().generation
    store.getState().replaceFlow({ nodes: [], edges: [] })
    store.getState().resetFlow()
    expect(store.getState().generation).toBe(before + 2)
  })
})
