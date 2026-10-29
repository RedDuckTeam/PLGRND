import { describe, expect, it } from 'vitest'
import { parseCluster, readTxParams, urlWithoutTxParams, type Loc } from './embed-location'

const SIGNATURE = '2abZAN1BS4nHQnjHCq928rVQcvfpSYVYzfYphjKwyPABzFh3XoWU1nwZvQoHtUwEdR8ougDQoHxLn5dft1FYgjg8'

const loc = (search: string, hash = '', pathname = '/'): Loc => ({ pathname, search, hash })

describe('parseCluster', () => {
  it.each([
    ['mainnet', 'MAINNET'],
    ['Mainnet-Beta', 'MAINNET'],
    ['devnet', 'DEVNET'],
    ['testnet', undefined],
    ['', undefined],
    [null, undefined],
  ])('%s → %s', (raw, network) => {
    expect(parseCluster(raw)).toBe(network)
  })
})

describe('readTxParams', () => {
  it('reads a signature and its cluster from the query or the hash', () => {
    expect(readTxParams(loc(`?tx=${SIGNATURE}&cluster=devnet`))).toEqual({ input: SIGNATURE, network: 'DEVNET' })
    expect(readTxParams(loc('', `#tx=${SIGNATURE}`))).toEqual({ input: SIGNATURE })
  })

  it('ignores an unknown cluster', () => {
    expect(readTxParams(loc(`?tx=${SIGNATURE}&cluster=testnet`))).toEqual({ input: SIGNATURE })
  })

  it('keeps base64 intact whether or not its + was encoded', () => {
    expect(readTxParams(loc('?tx=AQAB+/9z==&mode=editor'))).toEqual({ input: 'AQAB+/9z==' })
    expect(readTxParams(loc('?tx=AQAB%2B%2F9z%3D%3D'))).toEqual({ input: 'AQAB+/9z==' })
    expect(readTxParams(loc('?tx=AQAB-_9z'))).toEqual({ input: 'AQAB-_9z' })
  })

  it('is null without a tx', () => {
    expect(readTxParams(loc('?cluster=devnet'))).toBeNull()
    expect(readTxParams(loc('?tx='))).toBeNull()
  })
})

describe('urlWithoutTxParams', () => {
  it('strips tx and cluster and keeps the other params', () => {
    expect(urlWithoutTxParams(loc(`?tx=${SIGNATURE}&cluster=devnet&ref=docs`))).toBe('/?ref=docs')
    expect(urlWithoutTxParams(loc(`?tx=${SIGNATURE}`, '', '/editor'))).toBe('/editor')
    expect(urlWithoutTxParams(loc('?ref=docs', `#tx=${SIGNATURE}&theme=light`))).toBe('/?ref=docs#theme=light')
  })

  it('leaves a part without them byte for byte', () => {
    const hash = '#flow=N4Ig+Lg$abc'
    expect(urlWithoutTxParams(loc(`?tx=${SIGNATURE}`, hash))).toBe(`/${hash}`)
  })

  it('is null when there is nothing to strip', () => {
    expect(urlWithoutTxParams(loc('?ref=docs', '#flow=abc'))).toBeNull()
  })
})
