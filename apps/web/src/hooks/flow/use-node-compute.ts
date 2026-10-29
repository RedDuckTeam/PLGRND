import { useEffect, useMemo, useRef } from 'react'
import type { NodeTypeEnum } from '@/types/node'
import { useTypedReactFlow } from '@/hooks/flow/use-typed-react-flow'
import { inputValues, type ResolvedInputs } from '@/utils/flow/resolve-inputs'
import { createComputeRunner, getNodeCompute, type ComputeContext, type NodeData } from '@/utils/node/compute'

const shallowEqual = (a: Record<string, unknown>, b: Record<string, unknown>) => {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && Object.is(a[k], b[k]))
}

// Keeps the previous object while its entries are the same, so the compute only re-runs on a real change.
const useShallowStable = <T extends Record<string, unknown>>(value: T): T => {
  const ref = useRef(value)
  if (!shallowEqual(ref.current, value)) ref.current = value
  return ref.current
}

/**
 * Runs the registry compute of a node when its resolved inputs or `data` change, and writes the outputs
 * only when they differ from the node's current data. `data` holds the node's own non-output fields
 * the compute reads (usually its UI state); stale async results are dropped. `context` passes services such
 * as the IDL resolver; keep its values stable (memoized), or every render re-runs the compute.
 */
export const useNodeCompute = (
  type: NodeTypeEnum,
  id: string,
  data: NodeData = {},
  resolved: ResolvedInputs = {},
  context: Omit<ComputeContext, 'signal'> = {}
) => {
  const { getNode, updateNodeData } = useTypedReactFlow()
  const inputs = useShallowStable(useMemo(() => inputValues(resolved), [resolved]))
  const params = useShallowStable(data)
  const ctx = useShallowStable(context)

  const runner = useMemo(
    () =>
      createComputeRunner(
        () => getNode(id)?.data,
        (outputs) => updateNodeData(id, outputs)
      ),
    [getNode, id, updateNodeData]
  )
  useEffect(() => () => runner.cancel(), [runner])

  useEffect(() => {
    const compute = getNodeCompute(type)
    if (compute) runner.run((signal) => compute(params, inputs, { ...ctx, signal }))
  }, [ctx, inputs, params, runner, type])
}
