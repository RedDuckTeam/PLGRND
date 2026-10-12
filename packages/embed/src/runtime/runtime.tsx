import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactFlowProvider } from '@xyflow/react'
import { DismissableLayerContext } from '@radix-ui/react-dismissable-layer'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PortalContainerContext } from '@/components/ui/portal-container'
import { DialogModeContext, type DialogMode, type DialogOutsideEvent } from '@/components/ui/dialog-mode'
import { EmbedCanvas } from '@/components/embed/embed-canvas'
import { EmbedHostContext, useEmbedHost, type EmbedHost } from '@/embed/embed-host-context'
import { buildPlgrndHref, PLGRND_ORIGIN } from '@/embed/plgrnd-links'
import type { RpcUrls } from '@/constants/solana/connection'
import { RpcConfigContext, type RpcConfig } from '@/providers/rpc-urls-context'
import { InertWalletProviders } from '@/providers/inert-wallet-providers'
import { createFlowStore, FlowStoreProvider } from '@/stores/flow-store'
import { createEmbedStore, EmbedStoreProvider, type EmbedStore } from '@/stores/embed-store'
import type { RuntimeCallbacks, RuntimeHandle, RuntimeInit } from '../types/runtime-api'
import { parseWidgetAttributes, type WidgetAttributes } from './attributes'
import { inspectFlowPayload, type FlowPayload } from './flow-payload'
import { applyRootPresentation, createShadowMount, createWidgetRoot, type ShadowMount } from './shadow-root'
import { WidgetBoundary } from './widget-boundary'

/** Tags runtime handles; artifact verification asserts it appears once per runtime artifact and never in the entry. */
export const RUNTIME_MARKER = '__PLGRND_RUNTIME__'

// M12 cross-widget rule: activity inside another <plgrnd-flow> never dismisses this widget's dialog.
const crossWidgetRule =
  (host: HTMLElement) =>
  (event: DialogOutsideEvent): void => {
    const original = event.detail.originalEvent
    const path = original.composedPath()
    // Touch outside-events fire after the click, when the path is already empty.
    const candidates = path.length > 0 ? path : [original.target]
    const widget = candidates.find((node) => node instanceof Element && node.localName === 'plgrnd-flow')
    if (widget && widget !== host) event.preventDefault()
  }

const FLOW_ERRORS: Record<Exclude<FlowPayload['kind'], 'ok'>, string> = {
  missing: 'This widget has no flow',
  invalid: 'This flow could not be loaded',
  newer: 'This flow needs a newer PLGRND widget',
}

function FlowErrorState({ kind, onRetry }: { kind: keyof typeof FLOW_ERRORS; onRetry: () => void }) {
  const { linkRef } = useEmbedHost()
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background text-foreground">
      <p className="font-mono text-sm">{FLOW_ERRORS[kind]}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-muted"
        >
          Retry
        </button>
        <a
          href={buildPlgrndHref('', linkRef)}
          target="_blank"
          rel="noopener"
          className="text-xs text-muted-foreground underline transition-colors hover:text-foreground"
        >
          plgrnd.io
        </a>
      </div>
    </div>
  )
}

interface FlowViewProps {
  flow?: string
  flowId: string
  onReady: () => void
  onRetry: () => void
}

function FlowView({ flow, flowId, onReady, onRetry }: FlowViewProps) {
  const payload: FlowPayload = useMemo(() => inspectFlowPayload(flow), [flow])
  if (payload.kind !== 'ok') return <FlowErrorState kind={payload.kind} onRetry={onRetry} />
  return (
    <EmbedCanvas snapshot={payload.snapshot} snapshotKey={flow ?? ''} onReady={onReady} selfHosted flowId={flowId} />
  )
}

/**
 * One flow's state. A new flow (or Retry) gets a fresh flow store and React Flow store, so nothing the previous flow's
 * nodes still do reaches the new one: neither a first commit in the new canvas nor a late async `updateNodeData`
 * (flows saved from one another share node ids).
 */
function FlowScope({ children }: { children: ReactNode }) {
  const [flowStore] = useState(() => createFlowStore())
  return (
    <FlowStoreProvider store={flowStore}>
      <ReactFlowProvider>{children}</ReactFlowProvider>
    </FlowStoreProvider>
  )
}

interface WidgetProps {
  host: HTMLElement
  portal: HTMLElement
  queryClient: QueryClient
  embedStore: EmbedStore
  attributes: WidgetAttributes
  /** Bumped on every `flow` change: the canvas is rebuilt, never re-initialized in place. */
  flowRevision: number
  flowId: string
  onReady: () => void
}

const sameUrls = (a: RpcUrls, b: RpcUrls) => a.MAINNET === b.MAINNET && a.DEVNET === b.DEVNET

function Widget({ host, portal, queryClient, embedStore, attributes, flowRevision, flowId, onReady }: WidgetProps) {
  const { flow, rpcUrls, linkRef } = attributes
  // Retry remounts the flow view, which re-reads the payload.
  const [attempt, setAttempt] = useState(0)
  const [dialogMode] = useState<DialogMode>(() => ({ modal: false, onInteractOutside: crossWidgetRule(host) }))
  // M18: a fresh Radix layer stack per widget.
  const [layers] = useState(() => ({
    layers: new Set<HTMLElement>(),
    layersWithOutsidePointerEventsDisabled: new Set<HTMLElement>(),
    branches: new Set<HTMLElement>(),
  }))
  // Public endpoints unless rpc-* says otherwise; Send confirms over HTTPS (no wss: needed in the host CSP).
  const [rpc, setRpc] = useState<RpcConfig>(() => ({ urls: rpcUrls, confirmMode: 'polling' }))
  if (!sameUrls(rpc.urls, rpcUrls)) setRpc({ urls: rpcUrls, confirmMode: 'polling' })
  // New endpoints: drop what the old ones returned and read again. This must run after the commit: effects run
  // children first, so every query below already holds a query function with the new URLs.
  const readWith = useRef(rpc)
  useEffect(() => {
    if (readWith.current === rpc) return
    readWith.current = rpc
    void queryClient.resetQueries()
  }, [queryClient, rpc])
  const hostLinks = useMemo<EmbedHost>(() => ({ editorOrigin: PLGRND_ORIGIN, linkRef }), [linkRef])

  return (
    <QueryClientProvider client={queryClient}>
      <RpcConfigContext.Provider value={rpc}>
        <EmbedHostContext.Provider value={hostLinks}>
          <EmbedStoreProvider store={embedStore}>
            <PortalContainerContext.Provider value={portal}>
              <DialogModeContext.Provider value={dialogMode}>
                <DismissableLayerContext.Provider value={layers}>
                  <InertWalletProviders>
                    <TooltipProvider>
                      <Toaster position="top-center" />
                      <WidgetBoundary>
                        <FlowScope key={`${attempt}:${flowRevision}`}>
                          <FlowView
                            flow={flow}
                            flowId={flowId}
                            onReady={onReady}
                            onRetry={() => setAttempt((n) => n + 1)}
                          />
                        </FlowScope>
                      </WidgetBoundary>
                    </TooltipProvider>
                  </InertWalletProviders>
                </DismissableLayerContext.Provider>
              </DialogModeContext.Provider>
            </PortalContainerContext.Provider>
          </EmbedStoreProvider>
        </EmbedHostContext.Provider>
      </RpcConfigContext.Provider>
    </QueryClientProvider>
  )
}

let widgetCount = 0

const warnIgnored = (ignored: string[]) => {
  if (import.meta.env.DEV && ignored.length > 0) {
    console.warn('[plgrnd] ignored invalid <plgrnd-flow> attributes:', ignored.join(', '))
  }
}

/** Mounts one widget into its shadow root (called by the element shell once the element nears the viewport). */
export function mount(
  shadow: ShadowRoot,
  host: HTMLElement,
  init: RuntimeInit,
  callbacks: RuntimeCallbacks
): RuntimeHandle {
  const dom = createShadowMount(shadow)
  try {
    return mountWidget(dom, host, init, callbacks)
  } catch (error) {
    // The shell's Retry mounts into the same shadow root again: leave nothing of this attempt behind.
    dom.destroy()
    throw error
  }
}

function mountWidget(
  dom: ShadowMount,
  host: HTMLElement,
  init: RuntimeInit,
  callbacks: RuntimeCallbacks
): RuntimeHandle {
  const n = ++widgetCount
  let attributes = parseWidgetAttributes(init.attributes)
  let flowRevision = 0
  warnIgnored(attributes.ignored)

  const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } })
  const embedStore = createEmbedStore({
    config: attributes.config,
    ignored: attributes.ignored,
    resolvedTheme: init.resolvedTheme,
  })
  const present = () => {
    const state = embedStore.getState()
    applyRootPresentation(dom.root, host, state.config, state.resolvedTheme)
  }
  present()

  const root = createWidgetRoot(dom.mount)
  const render = () =>
    root.render(
      <Widget
        host={host}
        portal={dom.portal}
        queryClient={queryClient}
        embedStore={embedStore}
        attributes={attributes}
        flowRevision={flowRevision}
        flowId={`plgrnd-${n}`}
        onReady={callbacks.onReady}
      />
    )
  render()

  return {
    marker: RUNTIME_MARKER,
    update(next) {
      const previous = attributes
      attributes = parseWidgetAttributes(next.attributes)
      if (attributes.ignored.join() !== previous.ignored.join()) warnIgnored(attributes.ignored)
      const state = embedStore.getState()
      state.setConfig(attributes.config, attributes.ignored)
      // The shell resolved the theme (host markers for "auto"); never re-resolve from the OS here (K25).
      state.setResolvedTheme(next.resolvedTheme)
      if (attributes.flow !== previous.flow) {
        flowRevision++
        state.setStatus('loading')
      }
      present()
      render()
    },
    unmount() {
      root.unmount()
      // Drops cached queries and their GC timers, so nothing of this widget outlives it (AC-R7).
      queryClient.clear()
      dom.destroy()
    },
  }
}
