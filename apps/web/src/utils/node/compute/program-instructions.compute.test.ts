import { Buffer } from 'buffer'
import { describe, expect, it } from 'vitest'
import { Keypair, SystemProgram, Transaction } from '@solana/web3.js'
import counterIdl from '@/constants/programs/counter/counter.json'
import { normalizeIdl } from '@/utils/idl/model/normalize'
import { computeInstructions } from './instructions.compute'
import { computeProgramInstructions } from './program-instructions.compute'

const key = (seed: number) => Keypair.fromSeed(new Uint8Array(32).fill(seed)).publicKey.toBase58()
const PROGRAM = key(9)
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const DISCRIMINATOR = '0102030405060708'

// Anchor >= 0.30: a fixed-address account, an optional one, a u64 argument.
const depositIdl = normalizeIdl(
  {
    address: PROGRAM,
    metadata: { name: 'demo', version: '0.1.0', spec: '0.1.0' },
    instructions: [
      {
        name: 'deposit',
        discriminator: [1, 2, 3, 4, 5, 6, 7, 8],
        accounts: [
          { name: 'user', writable: true, signer: true },
          { name: 'vault', writable: true },
          { name: 'authority', optional: true },
          { name: 'token_program', address: TOKEN_PROGRAM },
        ],
        args: [{ name: 'amount', type: 'u64' }],
      },
    ],
    accounts: [],
    types: [],
  },
  PROGRAM
)

// Legacy Anchor instruction with legacyOptionalAccountsStrategy (Shank, Token Metadata): an absent optional account is
// left out.
const legacyOptionalIdl = normalizeIdl(
  {
    version: '0.1.0',
    name: 'demo',
    instructions: [
      {
        name: 'poke',
        legacyOptionalAccountsStrategy: true,
        accounts: [
          { name: 'target', isMut: true, isSigner: false },
          { name: 'referrer', isMut: false, isSigner: false, isOptional: true },
        ],
        args: [],
      },
    ],
  },
  PROGRAM
)

// Shank: an optional signer counts as a signer.
const shankIdl = normalizeIdl(
  {
    version: '0.1.0',
    name: 'demo',
    metadata: { origin: 'shank', address: PROGRAM },
    instructions: [
      {
        name: 'Poke',
        accounts: [{ name: 'delegate', isMut: false, isSigner: false, isOptionalSigner: true }],
        args: [],
        discriminant: { type: 'u8', value: 3 },
      },
    ],
  },
  PROGRAM
)

const build = (idl: unknown, selectedInstruction: string, inputs: Record<string, unknown>) =>
  computeProgramInstructions({ selectedInstruction }, { idl, programId: PROGRAM, ...inputs })

const instruction = (tx: Transaction | null | undefined) => {
  const [ix] = tx!.instructions
  return {
    keys: ix.keys.map((k) => [k.pubkey.toBase58(), k.isSigner, k.isWritable]),
    data: Buffer.from(ix.data).toString('hex'),
  }
}

const depositInputs = { account_user: key(1), account_vault: key(2), arg_amount: '5' }

describe('computeProgramInstructions', () => {
  it('parses a TEXT string into a u64 argument and fills the fixed-address account from the IDL', async () => {
    const out = await build(depositIdl, 'deposit', depositInputs)
    expect(out.error).toBeNull()
    expect(instruction(out.transactionOut)).toEqual({
      keys: [
        [key(1), true, true],
        [key(2), false, true],
        // Unconnected optional account: Anchor's "programId" strategy passes the program id in its place.
        [PROGRAM, false, false],
        [TOKEN_PROGRAM, false, false],
      ],
      data: DISCRIMINATOR + '0500000000000000',
    })
  })

  it('prefers a connected account over the IDL address', async () => {
    const out = await build(depositIdl, 'deposit', { ...depositInputs, account_authority: key(3) })
    expect(instruction(out.transactionOut).keys[2]).toEqual([key(3), false, false])
  })

  it('appends to the incoming transaction', async () => {
    const transactionIn = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: Keypair.generate().publicKey,
        toPubkey: Keypair.generate().publicKey,
        lamports: 1,
      })
    )
    const out = await build(depositIdl, 'deposit', { ...depositInputs, transactionIn })
    expect(out.transactionOut?.instructions).toHaveLength(2)
    expect(out.transactionOut?.instructions[0]).toBe(transactionIn.instructions[0])
  })

  it('reports a missing account and builds nothing', async () => {
    const out = await build(depositIdl, 'deposit', { account_user: key(1), arg_amount: '5' })
    expect(out).toMatchObject({ transactionOut: null, error: 'Missing account vault' })
  })

  it('reports a missing or invalid argument', async () => {
    const missing = await build(depositIdl, 'deposit', { account_user: key(1), account_vault: key(2) })
    expect(missing).toMatchObject({ transactionOut: null, error: 'Missing argument amount' })
    const invalid = await build(depositIdl, 'deposit', { ...depositInputs, arg_amount: 'five' })
    expect(invalid.transactionOut).toBeNull()
    expect(invalid.error).toMatch(/integer/)
  })

  it('reports an invalid account address', async () => {
    const out = await build(depositIdl, 'deposit', { ...depositInputs, account_vault: 'nope' })
    expect(out).toMatchObject({ transactionOut: null, error: 'Invalid address for account vault: nope' })
  })

  it('fills systemProgram by name for legacy IDLs, as before', async () => {
    const idl = normalizeIdl(counterIdl, PROGRAM)
    const out = await build(idl, 'initialize', { account_counter: key(2), account_user: key(1) })
    expect(instruction(out.transactionOut).keys).toEqual([
      [key(2), false, true],
      [key(1), true, true],
      [SystemProgram.programId.toBase58(), false, false],
    ])
  })

  it('leaves an absent optional account out under the "omitted" strategy', async () => {
    const out = await build(legacyOptionalIdl, 'poke', { account_target: key(2) })
    expect(instruction(out.transactionOut).keys).toEqual([[key(2), false, true]])
    const connected = await build(legacyOptionalIdl, 'poke', { account_target: key(2), account_referrer: key(3) })
    expect(instruction(connected.transactionOut).keys).toEqual([
      [key(2), false, true],
      [key(3), false, false],
    ])
  })

  it('treats an optional signer as a signer', async () => {
    const out = await build(shankIdl, 'Poke', { account_delegate: key(4) })
    expect(instruction(out.transactionOut)).toEqual({ keys: [[key(4), true, false]], data: '03' })
  })

  it('takes count and flags from original metas, and appends remaining accounts', async () => {
    const out = await computeProgramInstructions(
      {
        selectedInstruction: 'deposit',
        metaOverrides: [
          { isSigner: true, isWritable: true },
          { isSigner: false, isWritable: false },
          { pubkey: key(5), isSigner: false, isWritable: true },
        ],
        remainingAccounts: [
          { pubkey: key(6), isSigner: false, isWritable: true },
          { pubkey: key(7), isSigner: true, isWritable: false },
        ],
      },
      { idl: depositIdl, programId: PROGRAM, ...depositInputs, remaining_1: key(8) }
    )
    expect(out.error).toBeNull()
    expect(instruction(out.transactionOut)).toEqual({
      keys: [
        [key(1), true, true],
        // The original flags win over the IDL's (vault is mut in the IDL).
        [key(2), false, false],
        // No edge or inline value: the pubkey stored with the meta.
        [key(5), false, true],
        // token_program is left out: the original passed three accounts. Then the remaining ones, edge first.
        [key(6), false, true],
        [key(8), true, false],
      ],
      data: DISCRIMINATOR + '0500000000000000',
    })
  })

  it('resolves overridden metas from edge or inline values, then the IDL default, else reports them', async () => {
    const metaOverrides = [
      { isSigner: true, isWritable: true },
      { isSigner: false, isWritable: true },
      { pubkey: key(5), isSigner: false, isWritable: false },
      { isSigner: false, isWritable: false },
    ]
    const out = await computeProgramInstructions(
      { selectedInstruction: 'deposit', metaOverrides },
      { idl: depositIdl, programId: PROGRAM, ...depositInputs, account_authority: key(4) }
    )
    expect(instruction(out.transactionOut).keys.slice(2)).toEqual([
      [key(4), false, false],
      [TOKEN_PROGRAM, false, false],
    ])
    const missing = await computeProgramInstructions(
      { selectedInstruction: 'deposit', metaOverrides },
      { idl: depositIdl, programId: PROGRAM, arg_amount: '5', account_user: key(1) }
    )
    expect(missing).toMatchObject({ transactionOut: null, error: 'Missing account vault' })
    const badRemaining = await computeProgramInstructions(
      { selectedInstruction: 'deposit', remainingAccounts: [{ pubkey: 'nope', isSigner: false, isWritable: false }] },
      { idl: depositIdl, programId: PROGRAM, ...depositInputs }
    )
    expect(badRemaining).toMatchObject({ transactionOut: null, error: 'Invalid address for account #4: nope' })
  })

  it('passes a failed upstream transaction on as null', async () => {
    const out = await build(depositIdl, 'deposit', { ...depositInputs, transactionIn: null })
    expect(out).toMatchObject({ transactionOut: null, error: 'The incoming transaction has an error' })
    const chained = await computeInstructions({}, { transactionIn: null })
    expect(chained.transactionOut).toBeNull()
  })

  it('passes the transaction through without an instruction, IDL or program id', async () => {
    const transactionIn = new Transaction()
    expect((await build(depositIdl, '', { transactionIn })).transactionOut).toBe(transactionIn)
    expect((await build(depositIdl, 'unknown', { transactionIn })).transactionOut).toBe(transactionIn)
    expect((await build(null, 'deposit', { transactionIn })).transactionOut).toBe(transactionIn)
    const noProgram = await computeProgramInstructions(
      { selectedInstruction: 'deposit' },
      { idl: depositIdl, transactionIn, ...depositInputs }
    )
    expect(noProgram).toEqual({ transactionOut: transactionIn, selectedInstruction: 'deposit', error: null })
  })
})
