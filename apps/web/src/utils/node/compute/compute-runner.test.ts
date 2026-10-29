import { describe, expect, it, vi } from 'vitest'
import { Transaction } from '@solana/web3.js'
import { createComputeRunner } from './compute-runner'
import type { NodeOutputs } from './types'

const deferred = () => {
  let resolve!: (outputs: NodeOutputs) => void
  const promise = new Promise<NodeOutputs>((r) => (resolve = r))
  return { promise, resolve }
}

describe('createComputeRunner', () => {
  it('does not write when the outputs equal the node data', async () => {
    const write = vi.fn()
    const runner = createComputeRunner(() => ({ transaction: new Transaction(), other: 1 }), write)

    runner.run(() => ({ transaction: new Transaction() }))
    runner.run(async () => ({ transaction: new Transaction() }))
    await Promise.resolve()

    expect(write).not.toHaveBeenCalled()
  })

  it('writes changed outputs', () => {
    const write = vi.fn()
    createComputeRunner(() => ({ pda: 'old' }), write).run(() => ({ pda: 'new' }))
    expect(write).toHaveBeenCalledWith({ pda: 'new' })
  })

  it('drops the result of an older, slower run and aborts it', async () => {
    const write = vi.fn()
    const runner = createComputeRunner(() => ({}), write)
    const slow = deferred()
    const fast = deferred()
    let slowSignal: AbortSignal | undefined

    runner.run((signal) => {
      slowSignal = signal
      return slow.promise
    })
    runner.run(() => fast.promise)

    fast.resolve({ value: 'new' })
    await fast.promise
    slow.resolve({ value: 'old' })
    await slow.promise
    await Promise.resolve()

    expect(slowSignal?.aborted).toBe(true)
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith({ value: 'new' })
  })

  it('drops a pending result after cancel', async () => {
    const write = vi.fn()
    const runner = createComputeRunner(() => ({}), write)
    const pending = deferred()

    runner.run(() => pending.promise)
    runner.cancel()
    pending.resolve({ value: 'late' })
    await pending.promise
    await Promise.resolve()

    expect(write).not.toHaveBeenCalled()
  })
})
