export type ResolvedConnection<V = unknown> = {
  sourceId?: string
  sourceHandleId?: string
  dataField?: string
  value: V
}

export type ResolvedInputs<T extends string = string> = Partial<Record<T, ResolvedConnection>>

/** An edge or a React Flow connection into the node whose inputs are resolved. */
export type InputConnection = {
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

/** The data field a handle reads or writes; CustomNode builds handle ids as `${nodeId}-${dataField}-${position}`. */
export const handleDataField = (handleId: string, nodeId: string): string =>
  handleId.slice(nodeId.length + 1).split('-')[0]

/**
 * Per target field: the value of the last connected edge, else the inline value (if any).
 * `sourceDataById` holds the current data of every connected source node.
 */
export function resolveInputs<T extends string = string>(
  connections: readonly InputConnection[],
  sourceDataById: ReadonlyMap<string, Record<string, unknown> | undefined>,
  inline?: Partial<Record<string, unknown>>
): ResolvedInputs<T> {
  const record: ResolvedInputs<T> = {}
  for (const connection of connections) {
    if (!connection.source || !connection.target) continue
    const data = sourceDataById.get(connection.source)
    const dataField = handleDataField(connection.sourceHandle!, connection.source)
    const raw = dataField && data ? data[dataField] : undefined

    const key = handleDataField(connection.targetHandle!, connection.target) as T

    record[key] = {
      sourceId: connection.source,
      sourceHandleId: connection.sourceHandle!,
      dataField,
      value: raw,
    }
  }
  for (const [field, value] of Object.entries(inline ?? {})) {
    if (value !== undefined && !Object.hasOwn(record, field)) record[field as T] = { value }
  }
  return record
}

/** The resolved values by target field, for a compute. */
export const inputValues = (resolved: ResolvedInputs): Record<string, unknown> => {
  const values: Record<string, unknown> = {}
  for (const [field, connection] of Object.entries(resolved)) values[field] = connection?.value
  return values
}
