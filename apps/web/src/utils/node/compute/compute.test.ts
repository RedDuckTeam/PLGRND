import { describe, expect, it } from 'vitest'
import { Buffer } from 'buffer'
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { NodeTypeEnum } from '@/types/node'
import { getNodeCompute, nodeComputeRegistry } from '.'

const key = (seed: number) => Keypair.fromSeed(new Uint8Array(32).fill(seed)).publicKey.toBase58()
const hex = (tx: unknown) => (tx as Transaction).instructions.map((ix) => Buffer.from(ix.data).toString('hex'))

const counterIdl = {
  version: '0.1.0',
  name: 'counter',
  instructions: [
    {
      name: 'increment',
      accounts: [
        { name: 'counter', isMut: true, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [],
    },
  ],
  metadata: { address: key(9) },
}

describe('compute registry', () => {
  it('has a compute for each supported type and none for opaque types', () => {
    expect(Object.keys(nodeComputeRegistry).sort()).toEqual(
      [
        'ATA',
        'IDL',
        'INSTRUCTIONS',
        'NETWORK',
        'NUMBER',
        'PDA',
        'PROGRAM_INSTRUCTIONS',
        'RAW_INSTRUCTION',
        'TEXT',
        'TRANSACTION_BUILDER',
        'WALLET',
      ].sort()
    )
    expect(getNodeCompute(NodeTypeEnum.BALANCE)).toBeUndefined()
    expect(getNodeCompute('toString')).toBeUndefined()
  })

  it('TRANSACTION_BUILDER starts an empty transaction', () => {
    const { transaction } = nodeComputeRegistry.TRANSACTION_BUILDER()
    expect(transaction).toBeInstanceOf(Transaction)
    expect(transaction?.instructions).toHaveLength(0)
  })

  it('INSTRUCTIONS appends a system transfer by default, after the incoming instructions', async () => {
    const transactionIn = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: new PublicKey(key(1)), toPubkey: new PublicKey(key(2)), lamports: 1 })
    )
    const inputs = { transactionIn, fromPubkey: key(1), toPubkey: key(2), amountUi: 0.01 }
    const { transactionOut } = await nodeComputeRegistry.INSTRUCTIONS({}, inputs)
    expect(hex(transactionOut)).toEqual(['020000000100000000000000', '020000008096980000000000'])
    expect(transactionOut).not.toBe(transactionIn)
  })

  it('INSTRUCTIONS builds the selected instruction', async () => {
    const { transactionOut } = await nodeComputeRegistry.INSTRUCTIONS(
      { instruction: 'computeUnitLimit' },
      { computeUnits: 50000 }
    )
    expect(hex(transactionOut)).toEqual(['0250c30000'])
  })

  it('PROGRAM_INSTRUCTIONS encodes the selected instruction and fills the system program', async () => {
    const { idl } = await nodeComputeRegistry.IDL({ idlJson: JSON.stringify(counterIdl) })
    const inputs = { idl, programId: key(9), account_counter: key(3) }
    const out = await nodeComputeRegistry.PROGRAM_INSTRUCTIONS({ selectedInstruction: 'increment' }, inputs)
    const [ix] = (out.transactionOut as Transaction).instructions
    expect(ix.programId.toBase58()).toBe(key(9))
    expect(ix.keys.map((k) => [k.pubkey.toBase58(), k.isSigner, k.isWritable])).toEqual([
      [key(3), false, true],
      [SystemProgram.programId.toBase58(), false, false],
    ])
    expect(hex(out.transactionOut)).toEqual(['0b12680968ae3b21'])
    expect(out).toMatchObject({ selectedInstruction: 'increment', programId: key(9) })
    // The parsed IDL stays on the IDL node (transient) instead of being copied into every consumer.
    expect(out).not.toHaveProperty('idl')
  })

  it('PROGRAM_INSTRUCTIONS passes the incoming transaction through without a selection', async () => {
    const transactionIn = new Transaction()
    const { idl } = await nodeComputeRegistry.IDL({ idlJson: JSON.stringify(counterIdl) })
    const out = await nodeComputeRegistry.PROGRAM_INSTRUCTIONS({}, { idl, programId: key(9), transactionIn })
    expect(out).toEqual({ transactionOut: transactionIn, selectedInstruction: '', error: null })
    const empty = await nodeComputeRegistry.PROGRAM_INSTRUCTIONS({ selectedInstruction: 'increment' }, {})
    expect(empty.transactionOut).toBeInstanceOf(Transaction)
    // A legacy IDL object (persisted by older versions) is not the model: nothing to build yet.
    const legacy = await nodeComputeRegistry.PROGRAM_INSTRUCTIONS(
      { selectedInstruction: 'increment' },
      { idl: counterIdl, programId: key(9), transactionIn }
    )
    expect(legacy.transactionOut).toBe(transactionIn)
  })

  it('IDL parses the JSON and falls back to the IDL address for the program id', async () => {
    const idlJson = JSON.stringify(counterIdl)
    const parsed = await nodeComputeRegistry.IDL({ idlJson })
    expect(parsed).toMatchObject({ idl: { kind: 'plgrnd-idl/1', format: 'anchor-legacy', name: 'counter' } })
    expect(parsed.programId).toBe(key(9))
    expect((await nodeComputeRegistry.IDL({ idlJson, programId: key(4) })).programId).toBe(key(4))
    expect(await nodeComputeRegistry.IDL({ idlJson: '{', programId: key(4) })).toMatchObject({
      idl: null,
      programId: key(4),
      status: { error: 'Invalid IDL JSON' },
    })
  })

  it('TEXT, NUMBER and NETWORK output their own data', () => {
    expect(nodeComputeRegistry.TEXT({ text: 'hi' })).toEqual({ text: 'hi' })
    expect(nodeComputeRegistry.NUMBER({ number: 0.01 })).toEqual({ number: 0.01 })
    expect(nodeComputeRegistry.NETWORK({ network: 'DEVNET' })).toEqual({ network: 'DEVNET' })
  })

  it('WALLET outputs the context wallet and its signer marker', () => {
    expect(nodeComputeRegistry.WALLET({}, {}, { walletPublicKey: key(1) })).toEqual({
      publicKey: key(1),
      wallet: { kind: 'wallet', publicKey: key(1) },
    })
    expect(nodeComputeRegistry.WALLET({}, {}, {})).toEqual({ publicKey: '', wallet: null })
  })

  it('ATA derives the associated token account for the selected token program', () => {
    const [owner, mint] = [key(1), key(2)]
    const expected = getAssociatedTokenAddressSync(
      new PublicKey(mint),
      new PublicKey(owner),
      true,
      TOKEN_2022_PROGRAM_ID
    )
    expect(nodeComputeRegistry.ATA({ tokenProgram: 'token-2022' }, { owner, mint: ` ${mint} ` })).toEqual({
      ata: expected.toBase58(),
      tokenProgram: 'token-2022',
    })
    expect(nodeComputeRegistry.ATA({}, { owner })).toEqual({ ata: '', tokenProgram: 'token' })
    expect(nodeComputeRegistry.ATA({}, { owner, mint: 'not-a-key' })).toEqual({ ata: '', tokenProgram: 'token' })
  })

  it('PDA orders seeds by handle name', () => {
    const programId = key(9)
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from('counter'), new PublicKey(key(1)).toBytes()],
      new PublicKey(programId)
    )
    expect(nodeComputeRegistry.PDA({}, { 'seed#1': key(1), programId, 'seed#0': 'counter' })).toEqual({
      pda: pda.toBase58(),
      bump,
    })
    expect(nodeComputeRegistry.PDA({}, { programId })).toEqual({ pda: '', bump: undefined })
  })
})
