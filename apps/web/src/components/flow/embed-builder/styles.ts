import { cn } from '@/lib/utils'

export const rowClass = 'flex flex-col gap-1.5'
export const labelClass = 'font-mono text-[11px] uppercase text-muted-foreground'
export const noteClass = 'font-mono text-[11px] leading-4 text-muted-foreground'

export const segmentClass = (active: boolean) =>
  cn(
    'cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] capitalize transition-colors',
    active
      ? 'border-primary bg-muted text-foreground'
      : 'border-border bg-transparent text-muted-foreground hover:text-foreground'
  )
