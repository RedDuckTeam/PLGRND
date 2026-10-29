import { describe, expect, it } from 'vitest'
import { inputValues, resolveInputs } from './resolve-inputs'

const edge = (source: string, sourceField: string, target: string, targetField: string) => ({
  source,
  target,
  sourceHandle: `${source}-${sourceField}-right`,
  targetHandle: `${target}-${targetField}-left`,
})

describe('resolveInputs', () => {
  const sources = new Map<string, Record<string, unknown>>([
    ['a', { text: 'from a' }],
    ['b', { number: 2 }],
  ])

  it('reads the source field of each edge, and the last edge to a field wins', () => {
    const resolved = resolveInputs([edge('a', 'text', 't', 'amount'), edge('b', 'number', 't', 'amount')], sources)
    expect(resolved).toEqual({
      amount: { sourceId: 'b', sourceHandleId: 'b-number-right', dataField: 'number', value: 2 },
    })
  })

  it('lets an edge beat an inline value and uses inline values for unconnected fields', () => {
    const resolved = resolveInputs([edge('a', 'text', 't', 'to')], sources, { to: 'inline to', amount: 5 })
    expect(resolved.to?.value).toBe('from a')
    expect(resolved.amount).toEqual({ value: 5 })
  })

  it('leaves an unconnected field without an inline value absent', () => {
    const resolved = resolveInputs([edge('a', 'text', 't', 'to')], sources, { amount: undefined })
    expect(Object.keys(resolved)).toEqual(['to'])
    expect(inputValues(resolved).amount).toBeUndefined()
  })

  it('resolves an edge from a missing source node to undefined', () => {
    expect(resolveInputs([edge('gone', 'text', 't', 'to')], sources).to?.value).toBeUndefined()
  })
})
