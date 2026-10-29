import { Buffer } from 'buffer'
import type { Node } from '@xyflow/react'
import LZString from 'lz-string'
import { describe, expect, it } from 'vitest'
import { fixtureResolveIdl, fixtureRpc, rebuildMessage } from '@/__fixtures__/import-helpers'
import { loadTxFixture, txFixtureNames } from '@/__fixtures__/tx-helpers'
import { decodeFlowFromHash, encodeFlowToHash } from '@/utils/flow/share'
import { decompileMessage } from '@/utils/solana/message-compiler'
import { sameInstruction } from './guard'
import { importTransaction } from './import-transaction'

/** Fixtures whose rebuilt message may differ from the wire bytes, each with the reason. Expected to stay empty. */
const DOCUMENTED_EXCEPTIONS: Record<string, string> = {}

const SHARE_LINK_LIMIT = 32 * 1024

const importFixture = async (name: string) => {
  const { rpc } = fixtureRpc(name)
  return importTransaction(loadTxFixture(name).input.value, { rpc, resolveIdl: fixtureResolveIdl() })
}

describe('import round trip', () => {
  it.each(txFixtureNames())(
    '%s: import → share link → evaluateTxChain → compileMessage gives the wire message',
    async (name) => {
      const fx = loadTxFixture(name)
      const result = await importFixture(name)

      // Auto-loaded IDLs travel by reference only.
      const hash = encodeFlowToHash(result.snapshot)
      expect(hash).not.toContain('rootNode')
      const flow = decodeFlowFromHash(hash)!
      expect(JSON.stringify(flow)).not.toContain('rootNode')

      const wire = new Uint8Array(Buffer.from(fx.wire, 'base64'))
      const altAccounts = fx.altAccounts ?? {}
      const { bytes, instructions } = await rebuildMessage(flow, { resolveIdl: fixtureResolveIdl() }, altAccounts)
      const original = decompileMessage(wire, altAccounts).instructions
      expect(instructions).toHaveLength(original.length)
      instructions.forEach((ix, i) => expect(sameInstruction(ix, original[i]), `instruction ${i}`).toBe(true))

      if (DOCUMENTED_EXCEPTIONS[name]) return
      expect(Buffer.from(bytes).toString('base64')).toBe(fx.wire)
    },
    60_000
  )

  it('has no documented exceptions', () => {
    expect(DOCUMENTED_EXCEPTIONS).toEqual({})
  })

  it('keeps the Jupiter share link within 32 kB', async () => {
    const result = await importFixture('jupiter-swap')
    expect(encodeFlowToHash(result.snapshot).length).toBeLessThanOrEqual(SHARE_LINK_LIMIT)
  })

  it('shares an imported flow as a v4 #flow= link whose IDL nodes hold references only', async () => {
    const result = await importFixture('jupiter-swap')
    const json = LZString.decompressFromEncodedURIComponent(encodeFlowToHash(result.snapshot))
    const payload = JSON.parse(json) as { v: number; nodes: Node[] }
    expect(payload.v).toBe(4)
    const idlNodes = payload.nodes.filter((node) => node.type === 'IDL')
    expect(idlNodes.length).toBeGreaterThan(0)
    for (const { data } of idlNodes) {
      expect(data).toMatchObject({
        autoLoad: true,
        ref: {
          programId: data.programId,
          network: 'MAINNET',
          source: expect.any(String),
          contentHash: expect.any(String),
        },
      })
      expect(data).not.toHaveProperty('idl')
      expect(data).not.toHaveProperty('idlJson')
    }
    expect(json).not.toContain('rootNode')
  })
})
