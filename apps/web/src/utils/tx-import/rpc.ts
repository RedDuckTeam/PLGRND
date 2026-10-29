import type { Network } from '@/types/network'
import { rpcFetch } from '@/constants/solana/connection'

/** An error response of a JSON-RPC call, e.g. code -32015 for a transaction version the request did not allow. */
export class RpcError extends Error {
  readonly code?: number

  constructor(message: string, code?: number) {
    super(message)
    this.name = 'RpcError'
    this.code = code
  }
}

/** One JSON-RPC endpoint: the `result` of a call, or an RpcError. */
export type JsonRpc = <T>(method: string, params: unknown[]) => Promise<T>

export type ImportRpc = Record<Network, JsonRpc>

export const rpcCall = async <T>(url: string, method: string, params: unknown[], signal?: AbortSignal): Promise<T> => {
  const response = await rpcFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal,
  })
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`)
  const body = (await response.json()) as { result?: T; error?: { code?: number; message?: string } }
  if (body.error) throw new RpcError(body.error.message ?? `${method} failed`, body.error.code)
  return body.result as T
}

const createJsonRpc =
  (url: string, signal?: AbortSignal): JsonRpc =>
  <T>(method: string, params: unknown[]) =>
    rpcCall<T>(url, method, params, signal)

/** JSON-RPC over the configured endpoints, one per network. */
export const createImportRpc = (urls: Record<Network, string>, signal?: AbortSignal): ImportRpc => ({
  MAINNET: createJsonRpc(urls.MAINNET, signal),
  DEVNET: createJsonRpc(urls.DEVNET, signal),
})
