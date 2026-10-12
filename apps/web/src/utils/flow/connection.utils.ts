import type { Edge } from '@xyflow/react'

const textCompatibleTargetTypes = new Set(['text', 'publicKey', 'signature', 'privateKey', 'mint'])
const publicKeyCompatibleTargetTypes = new Set(['publicKey', 'mint'])
const numberCompatibleTargetTypes = new Set(['number', 'uiAmount', 'decimals'])
const uiAmountCompatibleTargetTypes = new Set(['uiAmount', 'number'])
const decimalsCompatibleTargetTypes = new Set(['decimals', 'number'])
const walletCompatibleTargetTypes = new Set(['wallet', 'privateKey'])

const getHandleMaxConnections = (handleId: string | null | undefined, root: ParentNode) => {
  if (!handleId) return undefined

  const handleEl = root.querySelector(`[data-id="${handleId}"]`) as HTMLElement | null
  const raw = handleEl?.getAttribute('data-max-connections')
  if (!raw) return undefined

  const maxConnections = Number(raw)
  return Number.isFinite(maxConnections) ? maxConnections : undefined
}

export const canConnectToTargetHandle = (targetHandle: string | null | undefined, edges: Edge[], root: ParentNode) => {
  const maxConnections = getHandleMaxConnections(targetHandle, root)
  if (maxConnections === undefined) return true

  const currentConnections = edges.filter((edge) => edge.targetHandle === targetHandle).length
  return currentConnections < maxConnections
}

export const areHandleTypesCompatible = (srcType?: string | null, tgtType?: string | null) => {
  if (!tgtType) return true
  if (tgtType === 'any' || srcType === 'any') return true
  if (!srcType) return false
  if (srcType === tgtType) return true
  if (srcType === 'text' && textCompatibleTargetTypes.has(tgtType)) return true
  if (srcType === 'publicKey' && publicKeyCompatibleTargetTypes.has(tgtType)) return true
  if (srcType === 'number' && numberCompatibleTargetTypes.has(tgtType)) return true
  if (srcType === 'uiAmount' && uiAmountCompatibleTargetTypes.has(tgtType)) return true
  if (srcType === 'decimals' && decimalsCompatibleTargetTypes.has(tgtType)) return true
  if (srcType === 'wallet' && walletCompatibleTargetTypes.has(tgtType)) return true
  return false
}
