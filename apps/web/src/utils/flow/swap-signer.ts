import type { Edge, Node } from '@xyflow/react'
import { NodeTypeEnum } from '@/types/node'
import { handleDataField } from './resolve-inputs'

/**
 * Replaces an imported signer (a TEXT node holding its public key) with a WALLET node: every edge from the text now
 * comes from the wallet's public key, and a TRANSACTION without a signer is signed by the wallet when this signer
 * pays the fee.
 */
export function swapSignerForWallet(
  nodes: Node[],
  edges: Edge[],
  textNodeId: string,
  walletNodeId: string
): { nodes: Node[]; edges: Edge[] } {
  const text = nodes.find((n) => n.id === textNodeId)
  if (!text || text.type !== NodeTypeEnum.TEXT) return { nodes, edges }

  const wallet: Node = { id: walletNodeId, type: NodeTypeEnum.WALLET, position: text.position, data: {} }
  const fromWallet = `${walletNodeId}-publicKey-right`
  const rewired = edges.map((edge) => {
    if (edge.source !== textNodeId) return edge
    return {
      ...edge,
      id: `xy-edge__${fromWallet}-${edge.targetHandle}`,
      source: walletNodeId,
      sourceHandle: fromWallet,
    }
  })

  const paysFee = rewired.some(
    (e) =>
      e.source === walletNodeId &&
      nodes.find((n) => n.id === e.target)?.type === NodeTypeEnum.TRANSACTION_BUILDER &&
      handleDataField(e.targetHandle ?? '', e.target) === 'feePayer'
  )
  const signerEdges: Edge[] = []
  if (paysFee) {
    for (const tx of nodes.filter((n) => n.type === NodeTypeEnum.TRANSACTION)) {
      const signed = rewired.some(
        (e) => e.target === tx.id && handleDataField(e.targetHandle ?? '', tx.id) === 'privateKey'
      )
      if (signed) continue
      const sourceHandle = `${walletNodeId}-wallet-right`
      const targetHandle = `${tx.id}-privateKey-left`
      signerEdges.push({
        id: `xy-edge__${sourceHandle}-${targetHandle}`,
        source: walletNodeId,
        sourceHandle,
        target: tx.id,
        targetHandle,
      })
    }
  }

  return {
    nodes: [...nodes.filter((n) => n.id !== textNodeId), wallet],
    edges: [...rewired, ...signerEdges],
  }
}
