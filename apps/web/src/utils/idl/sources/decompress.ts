/** Decompressed IDLs larger than this are rejected (a corrupt or hostile account must not exhaust memory). */
export const MAX_IDL_BYTES = 4 * 1024 * 1024

export type Compression = 'none' | 'gzip' | 'zlib'

export async function decompress(data: Uint8Array, compression: Compression): Promise<Uint8Array> {
  if (compression === 'none') return checkSize(data)
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream(compression === 'gzip' ? 'gzip' : 'deflate'))
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > MAX_IDL_BYTES) {
      await reader.cancel()
      throw new Error(`IDL larger than ${MAX_IDL_BYTES} bytes`)
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

const checkSize = (data: Uint8Array) => {
  if (data.length > MAX_IDL_BYTES) throw new Error(`IDL larger than ${MAX_IDL_BYTES} bytes`)
  return data
}
