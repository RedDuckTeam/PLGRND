import { iframeGuide } from './iframe.ts'
import { nativePortGuide } from './native-port.ts'
import { openInPlgrndGuide } from './open-in-plgrnd.ts'
import { reactWrapperGuide } from './react-wrapper.ts'
import { selfHostedGuide } from './self-hosted.ts'
import type { MethodGuide } from './types.ts'

export type MethodSlug = 'iframe' | 'self-hosted' | 'react-wrapper' | 'open-in-plgrnd' | 'native-port'

export const GUIDES: Record<MethodSlug, MethodGuide> = {
  iframe: iframeGuide,
  'self-hosted': selfHostedGuide,
  'react-wrapper': reactWrapperGuide,
  'open-in-plgrnd': openInPlgrndGuide,
  'native-port': nativePortGuide,
}
