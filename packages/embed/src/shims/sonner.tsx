import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// M2: replaces `sonner` in the self-hosted build. sonner injects global CSS into the host <head> at import
// time and renders one viewport-fixed toaster per page; here every widget renders its own toaster inside its
// root, and the global `toast()` is routed to one widget:
//   1. the widget with the latest pointerdown/keydown in the last 2 s;
//   2. otherwise the most recently mounted widget.
// Two widgets mounting in the same task can misroute a mount-time toast (documented limitation). A toast raised
// while no widget is connected waits 2 s for one to mount, then is dropped: it belonged to a widget that is gone.

type ToastKind = 'default' | 'success' | 'error' | 'info' | 'warning'
type ToastId = string | number

interface ToastAction {
  label: React.ReactNode
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}

export interface ExternalToast {
  id?: ToastId
  description?: React.ReactNode
  action?: ToastAction
  duration?: number
}

interface ToastRecord {
  id: ToastId
  kind: ToastKind
  title: React.ReactNode
  description?: React.ReactNode
  action?: ToastAction
  duration: number
}

interface ToasterHandle {
  push: (toast: ToastRecord) => void
  dismiss: (id?: ToastId) => void
  isConnected: () => boolean
  mountedAt: number
  lastInteraction: number
}

const DEFAULT_DURATION = 4000
const INTERACTION_WINDOW = 2000
const MAX_PENDING = 20
const PENDING_TTL = 2000

const toasters: ToasterHandle[] = []
const pending: { record: ToastRecord; at: number }[] = []
let nextId = 1

const dropStalePending = (now: number) => {
  while (pending.length > 0 && now - pending[0].at > PENDING_TTL) pending.shift()
}

function route(): ToasterHandle | undefined {
  const connected = toasters.filter((toaster) => toaster.isConnected())
  const now = performance.now()
  const recent = connected
    .filter((toaster) => now - toaster.lastInteraction <= INTERACTION_WINDOW)
    .sort((a, b) => b.lastInteraction - a.lastInteraction)[0]
  if (recent) return recent
  return connected.sort((a, b) => b.mountedAt - a.mountedAt)[0]
}

function show(kind: ToastKind, title: React.ReactNode, options: ExternalToast = {}): ToastId {
  const record: ToastRecord = {
    id: options.id ?? nextId++,
    kind,
    title,
    description: options.description,
    action: options.action,
    duration: options.duration ?? DEFAULT_DURATION,
  }
  const target = route()
  if (target) {
    target.push(record)
  } else {
    const now = performance.now()
    dropStalePending(now)
    if (pending.length < MAX_PENDING) pending.push({ record, at: now })
  }
  return record.id
}

type ToastFn = (title: React.ReactNode, options?: ExternalToast) => ToastId

export const toast: ToastFn & {
  success: ToastFn
  error: ToastFn
  info: ToastFn
  warning: ToastFn
  message: ToastFn
  dismiss: (id?: ToastId) => void
} = Object.assign((title: React.ReactNode, options?: ExternalToast) => show('default', title, options), {
  success: (title: React.ReactNode, options?: ExternalToast) => show('success', title, options),
  error: (title: React.ReactNode, options?: ExternalToast) => show('error', title, options),
  info: (title: React.ReactNode, options?: ExternalToast) => show('info', title, options),
  warning: (title: React.ReactNode, options?: ExternalToast) => show('warning', title, options),
  message: (title: React.ReactNode, options?: ExternalToast) => show('default', title, options),
  dismiss: (id?: ToastId) => {
    for (const toaster of toasters) toaster.dismiss(id)
  },
})

export interface ToasterProps {
  position?: 'top-center' | 'top-left' | 'top-right' | 'bottom-center' | 'bottom-left' | 'bottom-right'
  theme?: 'light' | 'dark' | 'system'
  className?: string
  style?: React.CSSProperties
}

const KIND_CLASS: Record<ToastKind, string> = {
  default: '',
  success: 'border-l-4 border-l-[#22c55e]',
  error: 'border-l-4 border-l-[#ef4444]',
  info: 'border-l-4 border-l-[#3b82f6]',
  warning: 'border-l-4 border-l-[#f59e0b]',
}

export function Toaster({ position = 'top-center', className, style }: ToasterProps) {
  const listRef = React.useRef<HTMLOListElement>(null)
  const [toasts, setToasts] = React.useState<ToastRecord[]>([])
  const timers = React.useRef(new Map<ToastId, number>())

  const dismiss = React.useCallback((id?: ToastId) => {
    setToasts((current) => (id === undefined ? [] : current.filter((t) => t.id !== id)))
    const clear = (key: ToastId) => {
      window.clearTimeout(timers.current.get(key))
      timers.current.delete(key)
    }
    if (id === undefined) for (const key of [...timers.current.keys()]) clear(key)
    else clear(id)
  }, [])

  // Registered in a layout effect, so it exists before any passive effect of the same commit raises a toast.
  React.useLayoutEffect(() => {
    const node = listRef.current
    if (!node) return
    const root = node.getRootNode() as Document | ShadowRoot
    const handle: ToasterHandle = {
      push: (record) => {
        setToasts((current) => [...current.filter((t) => t.id !== record.id), record])
        const timer = window.setTimeout(() => dismiss(record.id), record.duration)
        window.clearTimeout(timers.current.get(record.id))
        timers.current.set(record.id, timer)
      },
      dismiss,
      isConnected: () => node.isConnected,
      mountedAt: performance.now(),
      lastInteraction: -Infinity,
    }
    const markInteraction = () => {
      handle.lastInteraction = performance.now()
    }
    root.addEventListener('pointerdown', markInteraction, true)
    root.addEventListener('keydown', markInteraction, true)
    toasters.push(handle)
    dropStalePending(performance.now())
    for (const { record } of pending.splice(0)) handle.push(record)
    const ownTimers = timers.current
    return () => {
      root.removeEventListener('pointerdown', markInteraction, true)
      root.removeEventListener('keydown', markInteraction, true)
      toasters.splice(toasters.indexOf(handle), 1)
      for (const timer of ownTimers.values()) window.clearTimeout(timer)
      ownTimers.clear()
    }
  }, [dismiss])

  const vertical = position.startsWith('top') ? 'top-3' : 'bottom-3'
  const horizontal = position.endsWith('left')
    ? 'left-3'
    : position.endsWith('right')
      ? 'right-3'
      : 'left-1/2 -translate-x-1/2'

  return (
    <ol
      ref={listRef}
      data-plgrnd-toaster=""
      aria-live="polite"
      className={cn(
        'pointer-events-none absolute z-[60] flex w-[min(356px,calc(100%-24px))] flex-col gap-2',
        vertical,
        horizontal,
        className
      )}
      style={style}
    >
      {toasts.map((t) => (
        <li
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          data-plgrnd-toast=""
          data-type={t.kind}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-md border border-border bg-popover p-3 font-sans text-[13px] leading-[18px] text-popover-foreground shadow-lg',
            KIND_CLASS[t.kind]
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground">{t.title}</div>
            {t.description !== undefined && (
              <div className="mt-0.5 break-all text-[12px] text-muted-foreground">{t.description}</div>
            )}
          </div>
          {t.action && (
            <button
              type="button"
              className="shrink-0 cursor-pointer rounded-sm bg-primary px-2 py-1 text-[12px] text-primary-foreground"
              onClick={(event) => {
                t.action?.onClick(event)
                dismiss(t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Close"
            className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => dismiss(t.id)}
          >
            <X className="size-3.5" />
          </button>
        </li>
      ))}
    </ol>
  )
}
