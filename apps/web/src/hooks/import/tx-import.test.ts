import bs58 from 'bs58'
import { describe, expect, it } from 'vitest'
import { fixtureResolveIdl, fixtureRpc, fixtureTransaction } from '@/__fixtures__/import-helpers'
import { fixtureIdl, loadTxFixture } from '@/__fixtures__/tx-helpers'
import { detectInput } from '@/utils/tx-import/detect-input'
import { importTransaction } from '@/utils/tx-import/import-transaction'
import { describeInput, pasteIdl, readPastedIdl } from './tx-import'

const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const COMPUTE_BUDGET = 'ComputeBudget111111111111111111111111111111'

const describeFixture = (name: string) => describeInput(detectInput(loadTxFixture(name).input.value))

describe('describeInput', () => {
  it('labels a signature', () => {
    expect(describeFixture('jupiter-swap')).toBe('Signature')
  })

  it('labels serialized transactions with encoding, version and signatures', () => {
    expect(describeFixture('jupiter-unsigned')).toBe('base64 transaction · v0 · 0 of 1 signatures')
    expect(describeFixture('partially-signed')).toBe('base64 transaction · legacy · 1 of 2 signatures')
    const base58 = bs58.encode(fixtureTransaction('spl-transfer-ata-create'))
    expect(describeInput(detectInput(base58))).toBe('base58 transaction · legacy · 2 signatures')
  })
})

describe('readPastedIdl', () => {
  const anchor = (address?: string) => JSON.stringify({ ...(address && { address }), instructions: [] })

  it('accepts an IDL that declares the program, or no program at all', () => {
    expect(readPastedIdl(anchor(TOKEN), TOKEN)).toEqual({ idl: { address: TOKEN, instructions: [] } })
    expect(readPastedIdl(anchor(), TOKEN)).toEqual({ idl: { instructions: [] } })
  })

  it('refuses an IDL declared for another program, in every format', () => {
    const refused = { error: `This IDL is for program ${COMPUTE_BUDGET}, not ${TOKEN}` }
    expect(readPastedIdl(anchor(COMPUTE_BUDGET), TOKEN)).toEqual(refused)
    expect(readPastedIdl(JSON.stringify({ metadata: { address: COMPUTE_BUDGET } }), TOKEN)).toEqual(refused)
    expect(readPastedIdl(JSON.stringify({ kind: 'rootNode', program: { publicKey: COMPUTE_BUDGET } }), TOKEN)).toEqual(
      refused
    )
  })

  it('refuses text that is not a JSON object', () => {
    expect(readPastedIdl('{ "instructions": [', TOKEN)).toEqual({ error: 'Not valid JSON' })
    expect(readPastedIdl('[]', TOKEN)).toEqual({ error: 'Not an IDL: expected a JSON object' })
    expect(readPastedIdl('null', TOKEN)).toEqual({ error: 'Not an IDL: expected a JSON object' })
  })
})

describe('pasteIdl', () => {
  const importWithoutToken = () => {
    const name = 'spl-transfer-ata-create'
    return importTransaction(loadTxFixture(name).input.value, {
      rpc: fixtureRpc(name).rpc,
      resolveIdl: fixtureResolveIdl([TOKEN]),
    })
  }

  it("decodes the program's RAW instructions and reports how many", async () => {
    const result = await importWithoutToken()
    const pasted = await pasteIdl(result, TOKEN, JSON.stringify(await fixtureIdl(TOKEN)))
    expect(pasted.decoded).toBe(3)
    expect(pasted.warnings).toEqual([])
    expect(pasted.result.summary).toEqual({ decoded: 4, total: 4, missingIdls: [] })
  })

  it('reports the instructions an IDL without an address leaves raw', async () => {
    const result = await importWithoutToken()
    const idl = (await fixtureIdl(COMPUTE_BUDGET)) as { program: Record<string, unknown> }
    const unaddressed = { ...idl, program: { ...idl.program, publicKey: '' } }
    const pasted = await pasteIdl(result, TOKEN, JSON.stringify(unaddressed))
    expect(pasted.decoded).toBe(0)
    expect(pasted.warnings).toContain('Instruction 2 stays raw: The IDL does not recognize this instruction')
  })

  it("refuses another program's IDL before decoding anything", async () => {
    const result = await importWithoutToken()
    const idl = await fixtureIdl(COMPUTE_BUDGET)
    await expect(pasteIdl(result, TOKEN, JSON.stringify(idl))).rejects.toThrow(
      `This IDL is for program ${COMPUTE_BUDGET}, not ${TOKEN}`
    )
  })
})
