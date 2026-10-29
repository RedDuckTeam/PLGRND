// Frozen copy of the pre-rework IDL builder (formerly utils/idl), kept only so the baseline capture stays reproducible.
import { Buffer } from 'buffer'
import { PublicKey } from '@solana/web3.js'
import type { IdlInstruction } from './idl-types'
import { sha256 } from 'js-sha256'

export const encodeInstructionData = (
  instructionName: string,
  args: Record<string, unknown>,
  instruction: IdlInstruction
): Buffer => {
  try {
    // Anchor discriminator: first 8 bytes of SHA256("global:<instruction_name>")
    const discriminatorStr = `global:${instructionName}`
    const hash = sha256(discriminatorStr)
    const discriminator = Buffer.from(hash, 'hex').slice(0, 8)

    const argsData: Buffer[] = []

    for (const arg of instruction.args) {
      const value = args[`arg_${arg.name}`]
      if (value !== undefined && value !== null) {
        const type = typeof arg.type === 'string' ? arg.type : 'unknown'

        switch (type) {
          case 'u8':
          case 'i8': {
            const buf = Buffer.alloc(1)
            buf.writeUInt8(Number(value))
            argsData.push(buf)
            break
          }
          case 'u16':
          case 'i16': {
            const buf = Buffer.alloc(2)
            buf.writeUInt16LE(Number(value))
            argsData.push(buf)
            break
          }
          case 'u32':
          case 'i32': {
            const buf = Buffer.alloc(4)
            buf.writeUInt32LE(Number(value))
            argsData.push(buf)
            break
          }
          case 'u64':
          case 'i64': {
            const buf = Buffer.alloc(8)
            buf.writeBigUInt64LE(BigInt(value as string | number))
            argsData.push(buf)
            break
          }
          case 'u128':
          case 'i128': {
            const buf = Buffer.alloc(16)
            buf.writeBigUInt64LE(BigInt(value as string | number) & BigInt('0xFFFFFFFFFFFFFFFF'))
            argsData.push(buf)
            break
          }
          case 'bool': {
            const buf = Buffer.alloc(1)
            buf.writeUInt8(value ? 1 : 0)
            argsData.push(buf)
            break
          }
          case 'string': {
            const str = String(value)
            const strBuf = Buffer.from(str, 'utf-8')
            const lenBuf = Buffer.alloc(4)
            lenBuf.writeUInt32LE(strBuf.length)
            argsData.push(lenBuf, strBuf)
            break
          }
          case 'publicKey': {
            try {
              const pubkey = new PublicKey(String(value))
              argsData.push(Buffer.from(pubkey.toBytes()))
            } catch (error) {
              console.error('Error parsing public key:', error)
              // Push empty bytes for invalid public key
              argsData.push(Buffer.alloc(32))
            }
            break
          }
          default:
            console.warn(`Unsupported type for encoding: ${type}`)
        }
      }
    }

    return Buffer.concat([discriminator, ...argsData])
  } catch (error) {
    console.error('Error encoding instruction data:', error)
    // Return empty buffer on error
    return Buffer.alloc(0)
  }
}
