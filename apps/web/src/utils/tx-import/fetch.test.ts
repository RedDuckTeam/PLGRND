import bs58 from 'bs58'
import { Buffer } from 'buffer'
import { describe, expect, it } from 'vitest'
import { getAssociatedTokenAddressSync, NATIVE_MINT } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import { fixtureResolveIdl, fixtureRpc } from '@/__fixtures__/import-helpers'
import { loadTxFixture } from '@/__fixtures__/tx-helpers'
import { UnsupportedTransactionVersionError } from '@/utils/solana/message-compiler'
import { detectInput, TxImportError } from './detect-input'
import { fetchTransaction } from './fetch'
import { importTransaction } from './import-transaction'
import { RpcError } from './rpc'

const base64Byte = (value: number) => Buffer.from([value]).toString('base64')

const signatureOf = (name: string) => detectInput(loadTxFixture(name).input.value)

const rejection = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('Expected a rejection')
}

describe('fetchTransaction by signature', () => {
  it('asks for the raw base64 transaction, version 0 allowed, confirmed', async () => {
    let params: unknown[] = []
    const { rpc } = fixtureRpc('jupiter-swap', {
      handle: (_, method, p) => {
        if (method === 'getTransaction') params = p
        return undefined
      },
    })
    const fetched = await fetchTransaction(signatureOf('jupiter-swap'), { rpc })
    expect(params).toEqual([
      loadTxFixture('jupiter-swap').input.value,
      { encoding: 'base64', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
    ])
    expect(fetched.network).toBe('MAINNET')
    expect(Buffer.from(fetched.message).toString('base64')).toBe(loadTxFixture('jupiter-swap').wire)
    expect(fetched.serialized).toBe(false)
    // Lookup table entries come from the loaded addresses, at the indexes the message uses.
    expect(Object.keys(fetched.altAccounts)).toEqual(Object.keys(loadTxFixture('jupiter-swap').altAccounts!))
  })

  it('falls back to devnet when mainnet does not have it', async () => {
    const { rpc, calls } = fixtureRpc('token-metadata')
    const fetched = await fetchTransaction(signatureOf('token-metadata'), { rpc })
    expect(fetched.network).toBe('DEVNET')
    expect(calls).toEqual(['MAINNET getTransaction', 'DEVNET getTransaction'])
  })

  it('looks only on an explicit network', async () => {
    const both = fixtureRpc('spl-transfer-ata-create', { foundOn: ['MAINNET', 'DEVNET'] })
    const fetched = await fetchTransaction(signatureOf('spl-transfer-ata-create'), { rpc: both.rpc, network: 'DEVNET' })
    expect(fetched.network).toBe('DEVNET')
    expect(both.calls).toEqual(['DEVNET getTransaction'])

    const mainnetOnly = fixtureRpc('spl-transfer-ata-create')
    const error = await rejection(
      fetchTransaction(signatureOf('spl-transfer-ata-create'), { rpc: mainnetOnly.rpc, network: 'DEVNET' })
    )
    expect(error).toMatchObject({ code: 'not-found', message: 'Transaction not found on DEVNET' })
    expect(mainnetOnly.calls).toEqual(['DEVNET getTransaction'])
  })

  it('reports a transaction found on neither network', async () => {
    const { rpc } = fixtureRpc('jupiter-swap', { foundOn: [] })
    const error = await rejection(fetchTransaction(signatureOf('jupiter-swap'), { rpc }))
    expect(error).toBeInstanceOf(TxImportError)
    expect(error).toMatchObject({ code: 'not-found', message: 'Transaction not found on MAINNET or DEVNET' })
  })

  it('keeps searching after an RPC failure and mentions it when nothing is found', async () => {
    const failing = (network: string, method: string) => {
      if (network === 'MAINNET' && method === 'getTransaction') throw new Error('getTransaction: HTTP 429')
      return undefined
    }
    const found = fixtureRpc('jupiter-swap', { foundOn: ['DEVNET'], handle: failing })
    expect((await fetchTransaction(signatureOf('jupiter-swap'), { rpc: found.rpc })).network).toBe('DEVNET')

    const missing = fixtureRpc('jupiter-swap', { foundOn: [], handle: failing })
    const error = await rejection(fetchTransaction(signatureOf('jupiter-swap'), { rpc: missing.rpc }))
    expect((error as Error).message).toBe(
      'Transaction not found on MAINNET or DEVNET (MAINNET: getTransaction: HTTP 429)'
    )
  })

  it('turns RPC error -32015 into an unsupported-version error', async () => {
    const { rpc } = fixtureRpc('jupiter-swap', {
      handle: (_, method) => {
        if (method !== 'getTransaction') return undefined
        throw new RpcError(
          'Transaction version (1) is not supported by the requesting client. Please try the request again with the following configuration parameter: "maxSupportedTransactionVersion": 1',
          -32015
        )
      },
    })
    const error = await rejection(fetchTransaction(signatureOf('jupiter-swap'), { rpc }))
    expect(error).toBeInstanceOf(UnsupportedTransactionVersionError)
    expect(error).toMatchObject({ version: 1 })
  })
})

describe('fetchTransaction for a serialized transaction', () => {
  it('loads lookup tables and simulates on mainnet by default', async () => {
    const fx = loadTxFixture('jupiter-unsigned')
    let config: Record<string, unknown> = {}
    const { rpc, calls } = fixtureRpc('jupiter-unsigned', {
      handle: (_, method, params) => {
        if (method === 'simulateTransaction') config = params[1] as Record<string, unknown>
        return undefined
      },
    })
    const fetched = await fetchTransaction(detectInput(fx.input.value), { rpc })
    expect(calls).toEqual(['MAINNET getMultipleAccounts', 'MAINNET simulateTransaction'])
    expect(config).toMatchObject({
      encoding: 'base64',
      sigVerify: false,
      replaceRecentBlockhash: true,
      innerInstructions: true,
    })
    expect(fetched).toMatchObject({ network: 'MAINNET', serialized: true, source: { serialized: fx.input.value } })
    expect(fetched.altAccounts).toEqual(fx.altAccounts)
    // The simulation returned everything: no fallback calls.
    expect(fetched.execution).toMatchObject({ fee: (fx.simulation as { fee: number }).fee })
  })

  it('simulates on an explicit network', async () => {
    const fx = loadTxFixture('partially-signed')
    const { rpc, calls } = fixtureRpc('partially-signed')
    const fetched = await fetchTransaction(detectInput(fx.input.value), { rpc, network: 'DEVNET' })
    expect(fetched.network).toBe('DEVNET')
    // The failed simulation has no fee: it comes from getFeeForMessage.
    expect(calls).toEqual(['DEVNET simulateTransaction', 'DEVNET getFeeForMessage'])
  })

  it('fills the fee and balances a simulation lacks', async () => {
    const fx = loadTxFixture('jupiter-unsigned')
    const signer = new PublicKey('Hasda78TSaT9bjiPxDBvP4GpohFpP3TDTaJEcCYK5kyN')
    const wsolAccount = getAssociatedTokenAddressSync(NATIVE_MINT, signer).toBase58()
    const tokenAccount = (amount: bigint) => {
      const data = new Uint8Array(165)
      data.set(NATIVE_MINT.toBytes(), 0)
      data.set(signer.toBytes(), 32)
      new DataView(data.buffer).setBigUint64(64, amount, true)
      data[108] = 1
      return {
        lamports: 1_000_000,
        owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        data: [Buffer.from(data).toString('base64'), 'base64'],
      }
    }
    const lean = { ...fx.simulation } as Record<string, unknown>
    for (const key of ['fee', 'preBalances', 'postBalances', 'preTokenBalances', 'postTokenBalances']) delete lean[key]

    let writable: string[] = []
    const { rpc, calls } = fixtureRpc('jupiter-unsigned', {
      handle: (_, method, params) => {
        if (method === 'simulateTransaction') {
          writable = (params[1] as { accounts: { addresses: string[] } }).accounts.addresses
          const accounts = writable.map((a) =>
            a === wsolAccount ? tokenAccount(7n) : { lamports: 2, owner: '', data: ['', 'base64'] }
          )
          return { context: { slot: 1 }, value: { ...lean, accounts } }
        }
        if (method !== 'getMultipleAccounts') return undefined
        const [addresses, config] = params as [string[], { dataSlice?: unknown }]
        if (config.dataSlice)
          return { value: addresses.map(() => ({ lamports: 1, owner: '', data: [base64Byte(9), 'base64'] })) }
        if (addresses.includes(wsolAccount)) {
          return {
            value: addresses.map((a) =>
              a === wsolAccount ? tokenAccount(5n) : { lamports: 1, owner: '', data: ['', 'base64'] }
            ),
          }
        }
        return undefined
      },
    })
    const fetched = await fetchTransaction(detectInput(fx.input.value), { rpc })
    expect(calls).toContain('MAINNET getFeeForMessage')
    const execution = fetched.execution!
    expect(execution.fee).toBe(5000)
    expect(writable).toContain(wsolAccount)
    const keys = execution.preBalances!.length
    expect(execution.postBalances).toHaveLength(keys)
    const balance = (amount: string) => ({
      accountIndex: expect.any(Number),
      mint: NATIVE_MINT.toBase58(),
      owner: signer.toBase58(),
      uiTokenAmount: { amount, decimals: 9 },
    })
    expect(execution.preTokenBalances).toEqual([balance('5')])
    expect(execution.postTokenBalances).toEqual([balance('7')])
    const index = execution.preTokenBalances![0].accountIndex
    expect(execution.preBalances![index]).toBe(1_000_000)
  })
})

describe('importTransaction with a failing simulation', () => {
  it('completes when the simulated transaction fails', async () => {
    const fx = loadTxFixture('partially-signed')
    const { rpc } = fixtureRpc('partially-signed')
    const result = await importTransaction(fx.input.value, { rpc, resolveIdl: fixtureResolveIdl() })
    expect(result.summary).toMatchObject({ decoded: 2, total: 2 })
    expect(result.warnings).toContain('The simulation failed ("AccountNotFound"); TX TRACE shows the details')
  })

  it('completes when the RPC refuses to simulate', async () => {
    const fx = loadTxFixture('jupiter-unsigned')
    const { rpc } = fixtureRpc('jupiter-unsigned', {
      handle: (_, method) => {
        if (method === 'simulateTransaction')
          throw new RpcError('Transaction simulation failed: Blockhash not found', -32002)
        return undefined
      },
    })
    const result = await importTransaction(fx.input.value, { rpc, resolveIdl: fixtureResolveIdl() })
    expect(result.state.fetched.execution).toBeNull()
    expect(result.summary.total).toBe(6)
    expect(result.warnings[0]).toBe(
      'The transaction could not be simulated: Transaction simulation failed: Blockhash not found'
    )
    expect(bs58.decode(result.state.fetched.signatures[0]).every((b) => b === 0)).toBe(true)
  })
})
