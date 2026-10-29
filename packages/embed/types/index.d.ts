// Type declarations for @plgrnd/embed: the <plgrnd-flow> custom element.

type Flag = '1' | '0' | 'true' | 'false'

/**
 * Attributes of <plgrnd-flow>. Pass strings: until the element is defined, React 19 drops `{false}` and writes
 * `{true}` as an empty attribute.
 */
export interface PlgrndFlowAttributes {
  /** The flow payload: the same lz-string value as the hosted embed's `#flow=`. */
  flow?: string
  /**
   * A transaction to show as a flow (since 1.1.0): a signature, or a serialized transaction in base64 or base58.
   * It is imported over the RPC endpoints; `flow` wins when both are set.
   */
  tx?: string
  /**
   * The cluster of `tx` (since 1.1.0). Unset: a signature is looked up on mainnet, then devnet; a serialized
   * transaction is simulated on mainnet.
   */
  cluster?: 'mainnet' | 'devnet'
  /** `dark` (default), `light`, or `auto` (follows the host page's theme markers, then the OS). */
  theme?: 'dark' | 'light' | 'auto'
  /** Colours, hex with or without `#`. */
  bg?: string
  surface?: string
  fg?: string
  border?: string
  accent?: string
  /** Corner radius in px, 0-24. */
  radius?: string | number
  /** Font families; the defaults are the host page's font and the system monospace stack. */
  font?: string
  'font-mono'?: string
  controls?: Flag
  minimap?: Flag
  toolbar?: Flag
  mode?: 'readonly' | 'interactive'
  /** JSON-RPC endpoints (http: or https:); the defaults are the public cluster endpoints. */
  'rpc-mainnet'?: string
  'rpc-devnet'?: string
  /** Referral tag appended to outgoing plgrnd.io links (`ref` is accepted in plain HTML). */
  'link-ref'?: string
  ref?: string
}

export interface PlgrndFlowElement extends HTMLElement {
  flow: string | null
  tx: string | null
  cluster: string | null
  theme: string | null
  bg: string | null
  surface: string | null
  fg: string | null
  border: string | null
  accent: string | null
  radius: string | null
  font: string | null
  fontMono: string | null
  controls: string | null
  minimap: string | null
  toolbar: string | null
  mode: string | null
  rpcMainnet: string | null
  rpcDevnet: string | null
  linkRef: string | null
}

export interface PlgrndReadyEventDetail {
  version: string
}

type PlgrndFlowJsxProps = PlgrndFlowAttributes & {
  id?: string
  class?: string
  className?: string
  /** An object, as for any React element: React throws on a style string. */
  style?: Record<string, string | number>
  hidden?: boolean
  children?: never
  [attribute: `data-${string}`]: string | undefined
}

declare global {
  interface HTMLElementTagNameMap {
    'plgrnd-flow': PlgrndFlowElement
  }
  interface HTMLElementEventMap {
    'plgrnd:ready': CustomEvent<PlgrndReadyEventDetail>
  }
  // React 18 (@types/react 18) reads intrinsic elements from the global JSX namespace.
  namespace JSX {
    interface IntrinsicElements {
      'plgrnd-flow': PlgrndFlowJsxProps
    }
  }
}

// React 19 (@types/react 19) reads them from React.JSX.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'plgrnd-flow': PlgrndFlowJsxProps
    }
  }
}

export {}
