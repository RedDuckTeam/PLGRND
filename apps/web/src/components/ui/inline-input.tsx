import type * as React from 'react'
import { cn } from '@/lib/utils'

const stop = (e: React.SyntheticEvent) => e.stopPropagation()

/**
 * A compact value field next to an unconnected handle (CustomNode `renderInline`). It sits inside the handle, so
 * pointer events stop here: typing or selecting text never starts a connection or drags the node.
 */
export function InlineInput({
  className,
  error,
  onKeyDown,
  ...props
}: React.ComponentProps<'input'> & { error?: string | null }) {
  return (
    <input
      spellCheck={false}
      title={error ?? (typeof props.value === 'string' && props.value ? props.value : props.placeholder)}
      aria-invalid={error ? true : undefined}
      {...props}
      className={cn(
        'nodrag nopan h-[10px] w-[86px] min-w-0 rounded-[3px] border border-input bg-card px-1 font-mono text-[7px] leading-[8px] text-foreground outline-none',
        'placeholder:text-muted-foreground focus:border-foreground/50 disabled:cursor-not-allowed disabled:opacity-60',
        'aria-invalid:border-red-500',
        className
      )}
      onMouseDown={stop}
      onPointerDown={stop}
      onTouchStart={stop}
      onClick={stop}
      onDoubleClick={stop}
      onKeyUp={stop}
      onKeyDown={(e) => {
        e.stopPropagation()
        onKeyDown?.(e)
      }}
    />
  )
}
