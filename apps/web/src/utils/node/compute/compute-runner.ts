import { outputsEqual } from './outputs-equal'
import type { NodeData, NodeOutputs } from './types'

/**
 * Runs a node's compute and writes its outputs only when they differ from the node's current data.
 * Each run aborts the previous one; a result from a superseded or cancelled run is dropped.
 */
export const createComputeRunner = (read: () => NodeData | undefined, write: (outputs: NodeOutputs) => void) => {
  let runId = 0
  let controller: AbortController | undefined

  const commit = (id: number, outputs: NodeOutputs) => {
    if (id === runId && !outputsEqual(outputs, read())) write(outputs)
  }

  return {
    run(compute: (signal: AbortSignal) => NodeOutputs | Promise<NodeOutputs>) {
      controller?.abort()
      const current = new AbortController()
      controller = current
      const id = ++runId
      try {
        const result = compute(current.signal)
        if (result instanceof Promise) result.then((outputs) => commit(id, outputs)).catch(() => undefined)
        else commit(id, result)
      } catch {
        // A failing compute leaves the outputs as they were, like the node effects it replaces.
      }
    },
    cancel() {
      controller?.abort()
      runId++
    },
  }
}
