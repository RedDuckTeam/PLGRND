import { describe, expect, it } from 'vitest'
import { Keypair, SystemProgram, Transaction } from '@solana/web3.js'
import { outputsEqual } from './outputs-equal'

const from = Keypair.fromSeed(new Uint8Array(32).fill(1)).publicKey
const to = Keypair.fromSeed(new Uint8Array(32).fill(2)).publicKey
const transfer = (lamports: number) =>
  new Transaction().add(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports }))

describe('outputsEqual', () => {
  it('treats separately built transactions with the same instructions as equal', () => {
    expect(outputsEqual({ transactionOut: transfer(1) }, { transactionOut: transfer(1) })).toBe(true)
    expect(outputsEqual({ transaction: new Transaction() }, { transaction: new Transaction() })).toBe(true)
  })

  it('detects a change in instruction data, keys or flags', () => {
    expect(outputsEqual({ transactionOut: transfer(1) }, { transactionOut: transfer(2) })).toBe(false)
    const flipped = transfer(1)
    flipped.instructions[0].keys[1].isWritable = false
    expect(outputsEqual({ transactionOut: transfer(1) }, { transactionOut: flipped })).toBe(false)
  })

  it('does not treat a transaction mutated by Send as equal to a fresh build', () => {
    const sent = transfer(1)
    sent.feePayer = from
    expect(outputsEqual({ transactionOut: transfer(1) }, { transactionOut: sent })).toBe(false)
  })

  it('compares plain values structurally and ignores data fields that are not outputs', () => {
    const idl = { name: 'counter', instructions: [{ name: 'increment', accounts: [], args: [] }] }
    expect(outputsEqual({ idl: structuredClone(idl), programId: 'p' }, { idl, programId: 'p', idlJson: '{}' })).toBe(
      true
    )
    expect(outputsEqual({ pda: '', bump: undefined }, {})).toBe(false)
    expect(outputsEqual({ bump: undefined }, {})).toBe(true)
  })
})
