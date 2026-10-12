import * as React from 'react'
import type * as SelectPrimitive from '@radix-ui/react-select'
import { ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// M11 (S-N): replaces apps/web/src/components/ui/select.tsx in the self-hosted build. The trigger keeps the
// app's 8px look; a transparent native <select> (14px, so the OS popup list stays readable) sits on top and
// owns focus, keyboard and the popup. No portal, no scroll lock, no <style> injection, no document listeners.

interface SelectOption {
  value: string
  label: React.ReactNode
  text: string
  disabled?: boolean
}

interface SelectState {
  value?: string
  options: SelectOption[]
  placeholder?: React.ReactNode
  disabled?: boolean
  name?: string
  required?: boolean
  select: (value: string) => void
}

const SelectContext = React.createContext<SelectState | null>(null)

const useSelectState = (part: string): SelectState => {
  const state = React.useContext(SelectContext)
  if (!state) throw new Error(`[plgrnd] <${part}> must be used inside <Select>`)
  return state
}

const textOf = (node: React.ReactNode): string => {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

// Items and the placeholder are declared as children (inside SelectContent / SelectValue); read them from the tree.
const collect = (children: React.ReactNode, into: { options: SelectOption[]; placeholder?: React.ReactNode }) => {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<Record<string, unknown> & { children?: React.ReactNode }>(child)) return
    if (child.type === SelectItem) {
      const props = child.props as unknown as React.ComponentProps<typeof SelectItem>
      into.options.push({
        value: props.value,
        label: props.children,
        text: textOf(props.children),
        disabled: props.disabled,
      })
      return
    }
    if (child.type === SelectValue) {
      const props = child.props as unknown as React.ComponentProps<typeof SelectValue>
      if (props.placeholder !== undefined) into.placeholder = props.placeholder
    }
    collect(child.props.children, into)
  })
}

function Select({
  value,
  defaultValue,
  onValueChange,
  disabled,
  name,
  required,
  children,
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue)
  const current = value !== undefined ? value : uncontrolled
  const found: { options: SelectOption[]; placeholder?: React.ReactNode } = { options: [] }
  collect(children, found)

  const state: SelectState = {
    value: current,
    options: found.options,
    placeholder: found.placeholder,
    disabled,
    name,
    required,
    select: (next) => {
      if (value === undefined) setUncontrolled(next)
      onValueChange?.(next)
    },
  }
  return <SelectContext.Provider value={state}>{children}</SelectContext.Provider>
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  color,
  style,
  onKeyDown,
  onKeyUp,
  id,
  'aria-label': ariaLabel,
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & { size?: 'sm' | 'default' }) {
  const state = useSelectState('SelectTrigger')
  const selected = state.options.find((option) => option.value === state.value)

  // Same containment as select.tsx: keys pressed in the select never reach React Flow or the host page.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLSelectElement>) => {
    event.stopPropagation()
    onKeyDown?.(event as unknown as React.KeyboardEvent<HTMLButtonElement>)
  }
  const handleKeyUp = (event: React.KeyboardEvent<HTMLSelectElement>) => {
    event.stopPropagation()
    onKeyUp?.(event as unknown as React.KeyboardEvent<HTMLButtonElement>)
  }

  return (
    <div
      data-slot="select-trigger"
      data-size={size}
      data-placeholder={selected ? undefined : ''}
      data-disabled={state.disabled ? '' : undefined}
      style={{ '--primary': color, ...style } as React.CSSProperties}
      className={cn(
        "border-active-border data-[placeholder]:text-muted-foreground focus-within:border-primary [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full items-center justify-between gap-2 rounded-[8px] border bg-transparent px-2 py-1 text-[8px] leading-[9px] whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
    >
      {children}
      <ChevronDownIcon className="size-3 opacity-50" />
      <select
        id={id}
        aria-label={ariaLabel ?? (selected ? undefined : textOf(state.placeholder) || undefined)}
        name={state.name}
        required={state.required}
        disabled={state.disabled}
        value={state.value ?? ''}
        onChange={(event) => state.select(event.target.value)}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
        style={{ fontSize: 14 }}
      >
        {!selected && (
          <option value="" disabled hidden>
            {textOf(state.placeholder)}
          </option>
        )}
        {state.options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.text}
          </option>
        ))}
      </select>
    </div>
  )
}

function SelectValue({ placeholder }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  const state = useSelectState('SelectValue')
  const selected = state.options.find((option) => option.value === state.value)
  return <span data-slot="select-value">{selected ? selected.label : placeholder}</span>
}

// Declarative parts: Select reads their props; they render nothing themselves.
function SelectContent(_: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return null
}
function SelectItem(_: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return null
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
