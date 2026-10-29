import { Buffer } from 'buffer'
import { describe, expect, it } from 'vitest'
import { Keypair, SystemProgram, Transaction } from '@solana/web3.js'
import { computeRawInstruction } from './raw-instruction.compute'

const key = (seed: number) => Keypair.fromSeed(new Uint8Array(32).fill(seed)).publicKey.toBase58()
const SYSTEM = SystemProgram.programId.toBase58()

const transfer = {
  programId: SYSTEM,
  accounts: [
    { pubkey: key(1), isSigner: true, isWritable: true },
    { pubkey: key(2), isSigner: false, isWritable: true },
  ],
  dataHex: '02000000e803000000000000',
}

const instruction = (tx: Transaction | null | undefined) => {
  const ix = tx!.instructions[tx!.instructions.length - 1]
  return {
    programId: ix.programId.toBase58(),
    keys: ix.keys.map((k) => [k.pubkey.toBase58(), k.isSigner, k.isWritable]),
    data: Buffer.from(ix.data).toString('hex'),
  }
}

describe('computeRawInstruction', () => {
  it('builds the program id, ordered metas with flags and data bytes as given', () => {
    const out = computeRawInstruction(transfer, {})
    expect(out.error).toBeNull()
    expect(instruction(out.transactionOut)).toEqual({
      programId: SYSTEM,
      keys: [
        [key(1), true, true],
        [key(2), false, true],
      ],
      data: '02000000e803000000000000',
    })
    // Same bytes as the system program's own builder.
    const reference = SystemProgram.transfer({
      fromPubkey: Keypair.fromSeed(new Uint8Array(32).fill(1)).publicKey,
      toPubkey: Keypair.fromSeed(new Uint8Array(32).fill(2)).publicKey,
      lamports: 1000,
    })
    expect(Buffer.from(reference.data).toString('hex')).toBe('02000000e803000000000000')
  })

  it('accepts spaced or 0x-prefixed hex and empty data', () => {
    expect(instruction(computeRawInstruction({ ...transfer, dataHex: '0x02 00 00 00' }, {}).transactionOut).data).toBe(
      '02000000'
    )
    expect(instruction(computeRawInstruction({ ...transfer, dataHex: '' }, {}).transactionOut).data).toBe('')
  })

  it('takes an account from its edge before the typed pubkey', () => {
    const out = computeRawInstruction(transfer, { account_1: key(3) })
    expect(instruction(out.transactionOut).keys[1]).toEqual([key(3), false, true])
  })

  it('does not fall back to the typed pubkey while a connected account is empty', () => {
    expect(computeRawInstruction(transfer, { account_1: undefined })).toEqual({
      transactionOut: null,
      error: 'Missing account #1',
    })
  })

  it('appends to the incoming transaction', () => {
    const transactionIn = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: Keypair.generate().publicKey,
        toPubkey: Keypair.generate().publicKey,
        lamports: 1,
      })
    )
    const out = computeRawInstruction(transfer, { transactionIn })
    expect(out.transactionOut?.instructions).toHaveLength(2)
    expect(out.transactionOut?.instructions[0]).toBe(transactionIn.instructions[0])
  })

  it('reports invalid hex, addresses and missing accounts and builds nothing', () => {
    expect(computeRawInstruction({ ...transfer, dataHex: '0g' }, {})).toEqual({
      transactionOut: null,
      error: 'Invalid data: expected hex bytes',
    })
    expect(computeRawInstruction({ ...transfer, dataHex: '020' }, {}).transactionOut).toBeNull()
    expect(computeRawInstruction({ ...transfer, programId: 'nope' }, {})).toEqual({
      transactionOut: null,
      error: 'Invalid address for the program: nope',
    })
    expect(computeRawInstruction(transfer, { account_0: 'nope' })).toEqual({
      transactionOut: null,
      error: 'Invalid address for account #0: nope',
    })
    const missing = { ...transfer, accounts: [{ pubkey: '', isSigner: false, isWritable: false }] }
    expect(computeRawInstruction(missing, {})).toEqual({ transactionOut: null, error: 'Missing account #0' })
  })

  it('passes a failed upstream transaction on as null', () => {
    expect(computeRawInstruction(transfer, { transactionIn: null })).toEqual({
      transactionOut: null,
      error: 'The incoming transaction has an error',
    })
  })

  it('passes the transaction through until a program id is entered', () => {
    const transactionIn = new Transaction()
    expect(computeRawInstruction({}, { transactionIn })).toEqual({ transactionOut: transactionIn, error: null })
    expect(computeRawInstruction({ programId: ' ' }, {}).transactionOut).toBeInstanceOf(Transaction)
  })
})
