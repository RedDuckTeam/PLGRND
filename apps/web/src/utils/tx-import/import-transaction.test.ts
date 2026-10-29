import { Buffer } from 'buffer'
import type { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { fixtureResolveIdl, fixtureRpc, rebuildMessage } from '@/__fixtures__/import-helpers'
import { fixtureIdl, loadTxFixture, txFixtureNames, upstreamIdl } from '@/__fixtures__/tx-helpers'
import { handleDataField } from '@/utils/flow/resolve-inputs'
import { decodeFlowFromHash, encodeFlowToHash } from '@/utils/flow/share'
import { swapSignerForWallet } from '@/utils/flow/swap-signer'
import { idlContentHash } from '@/utils/idl/sources/content-hash'
import type { ResolveIdl } from '@/utils/node/compute/types'
import { decompileMessage, type AltAccounts } from '@/utils/solana/message-compiler'
import { checkFlow } from './guard'
import { applyPastedIdl, importTransaction, type ImportResult } from './import-transaction'
import { nodeBoxes } from './layout'

const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const SYSTEM = '11111111111111111111111111111111'
const TOKEN_METADATA = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
const COMPUTE_BUDGET = 'ComputeBudget111111111111111111111111111111'

const freshImport = (name: string, resolveIdl: ResolveIdl = fixtureResolveIdl()) =>
  importTransaction(loadTxFixture(name).input.value, { rpc: fixtureRpc(name).rpc, resolveIdl })

// Imports with every IDL available, shared by the read-only checks below.
const imports = new Map<string, Promise<ImportResult>>()
const importFixture = (name: string, resolveIdl?: ResolveIdl) => {
  if (resolveIdl) return freshImport(name, resolveIdl)
  if (!imports.has(name)) imports.set(name, freshImport(name))
  return imports.get(name)!
}

const wireOf = (name: string) => new Uint8Array(Buffer.from(loadTxFixture(name).wire, 'base64'))

const nodeById = (result: ImportResult, id: string) => result.snapshot.nodes.find((n) => n.id === id)!
const ofType = (result: ImportResult, type: string) => result.snapshot.nodes.filter((n) => n.type === type)
const field = (edge: Edge, side: 'source' | 'target') =>
  side === 'source'
    ? handleDataField(edge.sourceHandle!, edge.source)
    : handleDataField(edge.targetHandle!, edge.target)
const into = (result: ImportResult, id: string, targetField?: string) =>
  result.snapshot.edges.filter((e) => e.target === id && (!targetField || field(e, 'target') === targetField))
const sourceOf = (result: ImportResult, id: string, targetField: string) => {
  const [edge] = into(result, id, targetField)
  return edge && nodeById(result, edge.source)
}
const instructionData = (result: ImportResult, index: number) => nodeById(result, `ix${index}`).data

const expectSameMessage = async (result: ImportResult, name: string, ctx: Parameters<typeof rebuildMessage>[1]) => {
  const flow = decodeFlowFromHash(encodeFlowToHash(result.snapshot))!
  const { bytes } = await rebuildMessage(flow, ctx, (loadTxFixture(name).altAccounts ?? {}) as AltAccounts)
  expect(Buffer.from(bytes).toString('base64')).toBe(loadTxFixture(name).wire)
}

describe('generated flow structure', () => {
  it.each(txFixtureNames())('%s: signers, chain, IDL nodes, draft meta and trace', async (name) => {
    const fx = loadTxFixture(name)
    const result = await importFixture(name)
    const message = decompileMessage(wireOf(name), fx.altAccounts ?? {})
    const signers = message.staticKeys.slice(0, message.header.numRequiredSignatures)

    // Signers (fee payer included) are TEXT nodes marked as signers; the fee payer feeds TX BUILDER.
    const signerNodes = ofType(result, 'TEXT').filter((n) => n.data.signer)
    expect(signerNodes.map((n) => n.data.text)).toEqual(signers)
    expect(sourceOf(result, 'builder', 'feePayer')?.data).toEqual({ text: signers[0], signer: true })

    // TX BUILDER → one node per instruction, in order → TRANSACTION (+ NETWORK).
    let previous = 'builder'
    message.instructions.forEach((_, i) => {
      expect(sourceOf(result, `ix${i}`, 'transactionIn')?.id).toBe(previous)
      previous = `ix${i}`
    })
    expect(sourceOf(result, 'tx', 'transaction')?.id).toBe(previous)
    expect(sourceOf(result, 'tx', 'network')?.data).toEqual({ network: result.network })

    // One IDL node per decoded program, loaded by reference.
    const decodedPrograms = new Set(
      message.instructions
        .filter((_, i) => nodeById(result, `ix${i}`).type === 'PROGRAM_INSTRUCTIONS')
        .map((ix) => ix.programId)
    )
    const idls = ofType(result, 'IDL')
    expect(new Set(idls.map((n) => n.data.programId))).toEqual(decodedPrograms)
    expect(idls).toHaveLength(decodedPrograms.size)
    for (const idl of idls) {
      expect(idl.data).toMatchObject({
        autoLoad: true,
        network: result.network,
        ref: { programId: idl.data.programId },
      })
      expect(idl.data.idl).toBeUndefined()
    }
    for (const node of ofType(result, 'PROGRAM_INSTRUCTIONS')) {
      const idl = sourceOf(result, node.id, 'idl')!
      expect(sourceOf(result, node.id, 'programId')?.id).toBe(idl.id)
    }

    // Integers that do not fit a JavaScript number never become NUMBER nodes.
    for (const node of ofType(result, 'NUMBER')) expect(Number.isSafeInteger(node.data.number)).toBe(true)

    const builder = nodeById(result, 'builder').data as Record<string, unknown>
    expect(builder).toMatchObject({
      version: message.version,
      lookupTables: message.lookups.map((l) => l.table),
      original: { blockhash: message.recentBlockhash },
    })
    const original = builder.original as Record<string, unknown>
    if (fx.input.kind === 'signature') expect(original.signatures).toBeUndefined()

    expect(nodeById(result, 'trace').data).toEqual(
      fx.input.kind === 'signature'
        ? { signature: fx.input.value, network: result.network }
        : { serialized: Buffer.from(Buffer.from(fx.input.value, 'base64')).toString('base64'), network: result.network }
    )
  })

  it('stores the signatures of a partially signed input, and a durable nonce', async () => {
    const partial = await importFixture('partially-signed')
    const fx = loadTxFixture('partially-signed')
    expect((nodeById(partial, 'builder').data.original as Record<string, unknown>).signatures).toEqual({
      '4aHSPovXVynVxhTFPnHiRHxU82B9BR2GK8AVjhNxBMBB': fx.signatures![1],
    })
    const unsigned = await importFixture('jupiter-unsigned')
    expect((nodeById(unsigned, 'builder').data.original as Record<string, unknown>).signatures).toBeUndefined()

    const nonce = await importFixture('whirlpool-swap')
    expect((nodeById(nonce, 'builder').data.original as Record<string, unknown>).nonce).toMatchObject({
      authority: '9nXDunV8eNvYSVys7JSBkm2hz9Q79Q3EYeko19srVeMC',
    })
  })
})

describe('provenance', () => {
  it('spl-transfer-ata-create: ATAs wired from owner and mint, shared values as one node each', async () => {
    const result = await importFixture('spl-transfer-ata-create')
    expect(ofType(result, 'TEXT').filter((n) => n.data.signer)).toHaveLength(2)

    const atas = ofType(result, 'ATA')
    expect(atas).toHaveLength(3)
    const usdc = ofType(result, 'TEXT').find((n) => n.data.text === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')!
    for (const ata of atas) {
      expect(ata.data).toEqual({ tokenProgram: 'token' })
      expect(sourceOf(result, ata.id, 'owner')?.type).toBe('TEXT')
      expect(sourceOf(result, ata.id, 'mint')?.id).toBe(usdc.id)
    }
    // The ATA create's associated account comes from an ATA node owned by the `wallet` signer.
    const created = sourceOf(result, 'ix0', 'account_associatedTokenAccount')!
    expect(created.type).toBe('ATA')
    expect(sourceOf(result, created.id, 'owner')?.id).toBe(sourceOf(result, 'ix0', 'account_wallet')?.id)

    // The two transfers share amount and decimals: u64 as TEXT, u8 as NUMBER.
    for (const ix of ['ix1', 'ix2']) {
      expect(sourceOf(result, ix, 'arg_amount')?.data).toEqual({ text: '100' })
      expect(sourceOf(result, ix, 'arg_decimals')?.data).toEqual({ number: 6 })
    }
  })

  it('pumpfun-buy: IDL PDAs that reproduce the address become PDA nodes; the nested-seed one stays literal', async () => {
    const result = await importFixture('pumpfun-buy')
    const buy = instructionData(result, 4) as Record<string, unknown>
    expect(buy.selectedInstruction).toBe('buy_exact_sol_in')
    const message = decompileMessage(wireOf('pumpfun-buy'))
    const creatorVault = message.instructions[4].metas[9].pubkey
    expect((buy.inline as Record<string, string>).account_creator_vault).toBe(creatorVault)
    expect(into(result, 'ix4', 'account_creator_vault')).toEqual([])

    const pdaFed = [
      'global',
      'bonding_curve',
      'event_authority',
      'global_volume_accumulator',
      'user_volume_accumulator',
      'fee_config',
    ]
    for (const name of pdaFed) expect(sourceOf(result, 'ix4', `account_${name}`)?.type, name).toBe('PDA')
    expect(ofType(result, 'PDA')).toHaveLength(pdaFed.length)

    // Seeds: constants as TEXT, accounts from their nodes; the program id from the IDL node.
    const bondingCurve = sourceOf(result, 'ix4', 'account_bonding_curve')!
    expect(sourceOf(result, bondingCurve.id, 'seed#0')?.data).toEqual({ text: 'bonding-curve' })
    expect(sourceOf(result, bondingCurve.id, 'seed#1')?.id).toBe(sourceOf(result, 'ix4', 'account_mint')?.id)
    expect(sourceOf(result, bondingCurve.id, 'programId')?.type).toBe('IDL')
    // The bonding curve's token account is an ATA owned by the bonding curve PDA.
    const associated = sourceOf(result, 'ix4', 'account_associated_bonding_curve')!
    expect(associated.type).toBe('ATA')
    expect(sourceOf(result, associated.id, 'owner')?.id).toBe(bondingCurve.id)
  })

  it('whirlpool-swap: oracle PDA, programs without an IDL as RAW', async () => {
    const result = await importFixture('whirlpool-swap')
    const oracle = sourceOf(result, 'ix5', 'account_oracle')!
    expect(oracle.type).toBe('PDA')
    expect(sourceOf(result, oracle.id, 'seed#0')?.data).toEqual({ text: 'oracle' })
    expect(sourceOf(result, oracle.id, 'seed#1')?.id).toBe(sourceOf(result, 'ix5', 'account_whirlpool')?.id)
    expect(ofType(result, 'RAW_INSTRUCTION').map((n) => n.id)).toEqual(['ix3', 'ix4'])
    expect(result.summary).toEqual({
      decoded: 5,
      total: 7,
      missingIdls: [
        { programId: '9VFiimgx8hReh6TqamMFXFRXrtsZUfFGuoBTcW3jb7n8', instructionCount: 1 },
        { programId: 'ECzietWpJ5raCvNdx1xPxobXSy9WgTmdJfW2KeB81F28', instructionCount: 1 },
      ],
    })
    expect(instructionData(result, 3)).toMatchObject({ annotations: { reason: 'No IDL found for this program' } })
  })

  it('token-metadata: a 64-bit amount stays an inline string', async () => {
    const result = await importFixture('token-metadata')
    expect((instructionData(result, 4).inline as Record<string, string>).arg_amount).toBe('1000000000000000000')
    expect(ofType(result, 'NUMBER')).toEqual([])
  })

  it('jupiter-unsigned: the swapped amount links the SOL transfer and the route', async () => {
    const result = await importFixture('jupiter-unsigned')
    const amount = sourceOf(result, 'ix2', 'arg_amount')!
    expect(amount.data).toEqual({ text: '10000000' })
    expect(sourceOf(result, 'ix4', 'arg_in_amount')?.id).toBe(amount.id)
  })
})

describe('layout', () => {
  const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

  it.each(txFixtureNames())('%s: no two nodes overlap, and the layout is deterministic', async (name) => {
    const result = await importFixture(name)
    const boxes = nodeBoxes(result.snapshot.nodes, result.snapshot.edges)
    for (const box of boxes) expect(Number.isFinite(box.x) && Number.isFinite(box.y)).toBe(true)
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(overlaps(boxes[i], boxes[j]), `${boxes[i].id} / ${boxes[j].id}`).toBe(false)
      }
    }
    // TX TRACE sits below everything else.
    const trace = boxes.find((b) => b.id === 'trace')!
    expect(boxes.every((b) => b.id === 'trace' || b.y + b.height <= trace.y)).toBe(true)
    // No viewport: the canvas fits the view to the flow.
    expect(result.snapshot.viewport).toBeUndefined()

    expect((await freshImport(name)).snapshot).toEqual(result.snapshot)
  })
})

describe('guard', () => {
  // The IDL serves its real JSON to the decoder, then a copy with another transferSol discriminator to the check.
  const tamperedSystem = (): ResolveIdl => {
    const resolve = fixtureResolveIdl()
    return async (programId, options) => {
      const result = await resolve(programId, options)
      if (programId !== SYSTEM || !result.idl) return result
      const real = result.idl.raw
      const tampered = structuredClone(real) as {
        program: { instructions: { name: string; arguments: { name: string; defaultValue?: { number: number } }[] }[] }
      }
      const transfer = tampered.program.instructions.find((ix) => ix.name === 'transferSol')!
      transfer.arguments.find((a) => a.name === 'discriminator')!.defaultValue!.number = 99
      let reads = 0
      const idl = { ...result.idl, contentHash: idlContentHash(real) }
      Object.defineProperty(idl, 'raw', { get: () => (reads++ === 0 ? real : tampered) })
      return { ...result, idl }
    }
  }

  it('regenerates an instruction that does not rebuild as RAW, with the decode as read-only annotations', async () => {
    const result = await importFixture('memo-v2', tamperedSystem())
    expect(nodeById(result, 'ix0').type).toBe('RAW_INSTRUCTION')
    expect(instructionData(result, 0)).toMatchObject({
      programId: SYSTEM,
      annotations: {
        instruction: 'transferSol',
        args: { amount: '5277' },
        reason: 'Rebuilding the decoded instruction gave different bytes, so it stays raw',
      },
    })
    expect(nodeById(result, 'ix1').type).toBe('PROGRAM_INSTRUCTIONS')
    expect(result.summary).toMatchObject({ decoded: 1, total: 2 })
    expect(result.warnings).toEqual([
      'Instruction 1 stays raw: Rebuilding the decoded instruction gave different bytes, so it stays raw',
    ])
    // Only the signer stays wired into the RAW node.
    expect(
      into(result, 'ix0')
        .map((e) => field(e, 'target'))
        .sort()
    ).toEqual(['account_0', 'transactionIn'])
    await expectSameMessage(result, 'memo-v2', { resolveIdl: fixtureResolveIdl() })
  })

  it('names the instructions a modified flow no longer rebuilds', async () => {
    const result = await importFixture('whirlpool-swap')
    const nodes: Node[] = result.snapshot.nodes.map((n) =>
      n.id === 'ix3' ? { ...n, data: { ...n.data, dataHex: 'ff' } } : n
    )
    const message = decompileMessage(wireOf('whirlpool-swap'))
    const check = await checkFlow(
      { ...result.snapshot, nodes },
      { instructions: message.instructions, feePayer: message.staticKeys[0] },
      { resolveIdl: fixtureResolveIdl() }
    )
    expect(check).toEqual({ ok: false, mismatched: [3] })
  })
})

describe('applyPastedIdl', () => {
  it('turns the RAW instructions of a program into PROGRAM INSTRUCTIONS with the same bytes', async () => {
    const result = await importFixture('spl-transfer-ata-create', fixtureResolveIdl([TOKEN]))
    expect(result.summary).toEqual({ decoded: 1, total: 4, missingIdls: [{ programId: TOKEN, instructionCount: 3 }] })
    expect(['ix1', 'ix2', 'ix3'].map((id) => nodeById(result, id).type)).toEqual(Array(3).fill('RAW_INSTRUCTION'))

    const raw = await fixtureIdl(TOKEN)
    const pasted = await applyPastedIdl(result, TOKEN, JSON.stringify(raw))
    expect(pasted.summary).toEqual({ decoded: 4, total: 4, missingIdls: [] })
    expect([1, 2, 3].map((i) => instructionData(pasted, i).selectedInstruction)).toEqual([
      'transferChecked',
      'transferChecked',
      'closeAccount',
    ])
    const idl = sourceOf(pasted, 'ix1', 'idl')!
    expect(idl.data).toEqual({ idlJson: JSON.stringify(raw), programId: TOKEN })
    await expectSameMessage(pasted, 'spl-transfer-ata-create', { resolveIdl: fixtureResolveIdl([TOKEN]) })
  })

  it('leaves RAW instructions with a reason when the IDL does not describe them', async () => {
    const result = await importFixture('spl-transfer-ata-create', fixtureResolveIdl([TOKEN]))
    const pasted = await applyPastedIdl(result, TOKEN, await fixtureIdl(COMPUTE_BUDGET))
    expect(pasted.summary).toEqual({ decoded: 1, total: 4, missingIdls: [] })
    expect(instructionData(pasted, 1)).toMatchObject({
      annotations: { reason: 'The IDL does not recognize this instruction' },
    })
    expect(pasted.warnings).toContain('Instruction 2 stays raw: The IDL does not recognize this instruction')
  })

  it.skipIf(!upstreamIdl('token-metadata'))(
    'token-metadata: the cached upstream IDL decodes CreateMetadataAccountV3',
    async () => {
      const result = await importFixture('token-metadata')
      expect(nodeById(result, 'ix2').type).toBe('RAW_INSTRUCTION')
      const pasted = await applyPastedIdl(result, TOKEN_METADATA, upstreamIdl('token-metadata'))
      expect(nodeById(pasted, 'ix2').type).toBe('PROGRAM_INSTRUCTIONS')
      expect(instructionData(pasted, 2).selectedInstruction).toBe('CreateMetadataAccountV3')
      expect(pasted.summary).toEqual({ decoded: 6, total: 6, missingIdls: [] })
      await expectSameMessage(pasted, 'token-metadata', { resolveIdl: fixtureResolveIdl() })
    }
  )
})

describe('Use my wallet on an imported signer', () => {
  it('rewires the fee payer and every use to the wallet, and the flow still rebuilds the message', async () => {
    const result = await importFixture('spl-transfer-ata-create')
    const feePayer = sourceOf(result, 'builder', 'feePayer')!
    const uses = result.snapshot.edges.filter((e) => e.source === feePayer.id).length
    const swapped = swapSignerForWallet(result.snapshot.nodes, result.snapshot.edges, feePayer.id, 'wallet')

    expect(swapped.nodes.some((n) => n.id === feePayer.id)).toBe(false)
    expect(swapped.edges.some((e) => e.source === feePayer.id)).toBe(false)
    const fromWallet = swapped.edges.filter((e) => e.source === 'wallet')
    expect(fromWallet.filter((e) => field(e, 'source') === 'publicKey')).toHaveLength(uses)
    expect(fromWallet.map((e) => `${e.target}.${field(e, 'target')}`)).toEqual(
      expect.arrayContaining(['builder.feePayer', 'tx.privateKey'])
    )

    const flow = { nodes: swapped.nodes, edges: swapped.edges }
    const { bytes } = await rebuildMessage(
      flow,
      { resolveIdl: fixtureResolveIdl(), walletPublicKey: feePayer.data.text as string },
      {}
    )
    expect(Buffer.from(bytes).toString('base64')).toBe(loadTxFixture('spl-transfer-ata-create').wire)
  })
})
