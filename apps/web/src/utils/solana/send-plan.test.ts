import { describe, expect, it } from 'vitest'
import { Buffer } from 'buffer'
import { PublicKey, SystemProgram } from '@solana/web3.js'
import { loadTxFixture } from '@/__fixtures__/tx-helpers'
import { compileMessage, decompileMessage, type MessageInstruction } from './message-compiler'
import { detectDurableNonce, messageHash, planSend, type SendPlanInput } from './send-plan'

const key = (n: number) => new PublicKey(new Uint8Array(32).fill(n)).toBase58()
const [PAYER, MINT, WALLET, OTHER, NONCE_ACCOUNT] = [1, 2, 3, 4, 5].map(key)

const base: SendPlanInput = {
  matchesOriginal: true,
  original: { messageHash: 'ab', blockhash: 'original-hash', signatures: { [MINT]: 'mint-sig' } },
  feePayer: PAYER,
  instructionSigners: [PAYER, MINT],
  availableSigners: [PAYER],
  primarySigner: PAYER,
  blockhashValid: true,
  latestBlockhash: 'fresh-hash',
}

describe('planSend', () => {
  it('reuses the original blockhash and stored signatures of an unchanged message', () => {
    expect(planSend(base)).toEqual({
      feePayer: PAYER,
      feePayerReplaced: undefined,
      reuseOriginal: true,
      blockhash: 'original-hash',
      keptSignatures: { [MINT]: 'mint-sig' },
      signers: [PAYER],
      missingSigners: [],
    })
  })

  it('needs a fresh blockhash and every signature once the message changed', () => {
    const plan = planSend({ ...base, matchesOriginal: false })
    expect(plan).toMatchObject({ reuseOriginal: false, blockhash: 'fresh-hash', keptSignatures: {} })
    expect(plan.signers).toEqual([PAYER, MINT])
    expect(plan.missingSigners).toEqual([MINT])
  })

  it('needs a fresh blockhash and every signature once the original blockhash expired', () => {
    const plan = planSend({ ...base, blockhashValid: false })
    expect(plan).toMatchObject({ reuseOriginal: false, blockhash: 'fresh-hash', missingSigners: [MINT] })
  })

  it('keeps nothing for inputs without stored signatures (fetched transactions)', () => {
    const plan = planSend({ ...base, original: { messageHash: 'ab', blockhash: 'original-hash' } })
    expect(plan).toMatchObject({ reuseOriginal: true, blockhash: 'original-hash', keptSignatures: {} })
    expect(plan.missingSigners).toEqual([MINT])
  })

  it('replaces a fee payer that cannot sign with the primary signer, with a notice', () => {
    const plan = planSend({ ...base, availableSigners: [WALLET, MINT], primarySigner: WALLET })
    expect(plan).toMatchObject({
      feePayer: WALLET,
      feePayerReplaced: { from: PAYER, to: WALLET },
      reuseOriginal: false,
      blockhash: 'fresh-hash',
      keptSignatures: {},
    })
    expect(plan.signers).toEqual([WALLET, PAYER, MINT])
    expect(plan.missingSigners).toEqual([PAYER])
  })

  it('keeps a fee payer whose stored signature is reused', () => {
    const plan = planSend({
      ...base,
      original: { ...base.original!, signatures: { [PAYER]: 'payer-sig', [MINT]: 'mint-sig' } },
      availableSigners: [WALLET],
      primarySigner: WALLET,
    })
    expect(plan).toMatchObject({ feePayer: PAYER, feePayerReplaced: undefined, reuseOriginal: true })
    expect(plan.signers).toEqual([])
    expect(plan.missingSigners).toEqual([])
  })

  it('lists the fee payer as missing when nobody else can pay', () => {
    const plan = planSend({ ...base, availableSigners: [], primarySigner: undefined, matchesOriginal: false })
    expect(plan.feePayer).toBe(PAYER)
    expect(plan.missingSigners).toEqual([PAYER, MINT])
  })

  it('uses the primary signer when the draft names no fee payer', () => {
    const plan = planSend({ ...base, feePayer: undefined, original: undefined, matchesOriginal: false })
    expect(plan).toMatchObject({ feePayer: PAYER, feePayerReplaced: undefined, blockhash: 'fresh-hash' })
  })

  it('reuses a durable nonce while the nonce account still holds the message blockhash', () => {
    const plan = planSend({ ...base, blockhashValid: false, currentNonce: 'original-hash' })
    expect(plan).toMatchObject({
      reuseOriginal: true,
      blockhash: 'original-hash',
      keptSignatures: { [MINT]: 'mint-sig' },
    })
  })

  it('uses the current nonce as blockhash once the nonce advanced or the message changed', () => {
    expect(planSend({ ...base, currentNonce: 'next-nonce' })).toMatchObject({
      reuseOriginal: false,
      blockhash: 'next-nonce',
      keptSignatures: {},
    })
    expect(planSend({ ...base, matchesOriginal: false, currentNonce: 'original-hash' })).toMatchObject({
      reuseOriginal: false,
      blockhash: 'original-hash',
      keptSignatures: {},
    })
  })
})

describe('detectDurableNonce', () => {
  const advance = SystemProgram.nonceAdvance({
    noncePubkey: new PublicKey(NONCE_ACCOUNT),
    authorizedPubkey: new PublicKey(OTHER),
  })
  const asMessageInstruction = (ix: typeof advance): MessageInstruction => ({
    programId: ix.programId.toBase58(),
    metas: ix.keys.map((k) => ({ pubkey: k.pubkey.toBase58(), isSigner: k.isSigner, isWritable: k.isWritable })),
    data: new Uint8Array(ix.data),
  })

  it('finds AdvanceNonceAccount as instruction 0 only', () => {
    const nonceIx = asMessageInstruction(advance)
    expect(detectDurableNonce([nonceIx])).toEqual({ account: NONCE_ACCOUNT, authority: OTHER })
    const transfer = asMessageInstruction(
      SystemProgram.transfer({ fromPubkey: new PublicKey(PAYER), toPubkey: new PublicKey(OTHER), lamports: 1 })
    )
    expect(detectDurableNonce([transfer, nonceIx])).toBeNull()
    expect(detectDurableNonce([])).toBeNull()
  })
})

describe('partially signed fixture', () => {
  const fx = loadTxFixture('partially-signed')
  const wire = new Uint8Array(Buffer.from(fx.wire, 'base64'))
  const m = decompileMessage(wire)
  const signers = m.staticKeys.slice(0, m.header.numRequiredSignatures)
  const stored = Object.fromEntries(
    signers.map((s, i) => [s, fx.signatures![i]]).filter(([, sig]) => !/^1+$/.test(sig))
  )
  const [payer] = signers
  const plan = (instructions: MessageInstruction[]) => {
    const draft = { version: m.version, feePayer: payer, instructions }
    const bytes = compileMessage(draft, m.recentBlockhash, {}, m.hints)
    return planSend({
      matchesOriginal: messageHash(bytes) === messageHash(wire),
      original: { messageHash: messageHash(wire), blockhash: m.recentBlockhash, signatures: stored },
      feePayer: payer,
      instructionSigners: instructions.flatMap((ix) => ix.metas.filter((a) => a.isSigner).map((a) => a.pubkey)),
      availableSigners: [payer],
      primarySigner: payer,
      blockhashValid: true,
      latestBlockhash: 'fresh-hash',
    })
  }

  it('has the mint signature stored and the fee payer slot empty', () => {
    expect(Object.keys(stored)).toEqual([signers[1]])
  })

  it('unchanged: keeps the stored signature and needs only the fee payer', () => {
    expect(plan(m.instructions)).toMatchObject({
      reuseOriginal: true,
      blockhash: m.recentBlockhash,
      keptSignatures: stored,
      signers: [payer],
      missingSigners: [],
    })
  })

  it('edited: needs every signature and lists the missing mint signer', () => {
    const edited = m.instructions.map((ix, i) => (i === 1 ? { ...ix, data: Uint8Array.from([...ix.data, 0]) } : ix))
    expect(plan(edited)).toMatchObject({ reuseOriginal: false, keptSignatures: {}, missingSigners: [signers[1]] })
  })
})

describe('messageHash', () => {
  it('is the hex sha256 of the message bytes', () => {
    expect(messageHash(new Uint8Array())).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})
