import { describe, expect, it } from 'vitest'
import { evaluateTxChain } from '@/utils/flow/evaluate-tx-chain'
import { BASELINE } from './baseline'
import { BASELINE_CASES, BASELINE_WALLET, loadCaseFlow } from './baseline-cases'
import { serializeInstructions } from './evaluate-today'

// Hand-checked when the baseline was captured (2026-10-28):
// - systemTransfer 0.01 SOL: 02000000 (Transfer) + 8096980000000000 (10_000_000 lamports, u64 LE)
// - counter discriminators = sha256("global:<name>")[0..8]: increment 0b12680968ae3b21,
//   initialize afaf6d1f0d989bed, decrement 6ae3a83bf81b9665
// - compute budget: 02 + u32 LE units (50_000 = 50c30000), 03 + u64 LE micro-lamports (10_000 = 1027000000000000)
// - solanamobile increment(amount = 1): discriminator + 0100000000000000

describe('frozen baseline instruction bytes', () => {
  it('covers every case', () => {
    expect(Object.keys(BASELINE).sort()).toEqual(BASELINE_CASES.map((c) => c.name).sort())
  })

  it.each(BASELINE_CASES)('$name: evaluateTxChain builds the frozen instructions', async (c) => {
    const chains = await evaluateTxChain(loadCaseFlow(c), { walletPublicKey: BASELINE_WALLET })
    expect(chains.map((chain) => serializeInstructions(chain.transaction))).toEqual(BASELINE[c.name])
  })
})
