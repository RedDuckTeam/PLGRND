import { cn } from '@/app/lib/utils'

interface SectionHeadingProps {
  index: string
  label: string
  className?: string
}

export function SectionHeading({ index, label, className }: SectionHeadingProps) {
  return (
    <div className={cn('flex items-center gap-3 text-xs uppercase tracking-widest sm:text-sm', className)}>
      <span aria-hidden className="size-2 shrink-0 bg-current" />
      <span>{index}</span>
      <span aria-hidden className="opacity-50">
        /
      </span>
      <span className="whitespace-nowrap">{label}</span>
      <span aria-hidden className="h-px min-w-6 flex-1 bg-current opacity-20" />
    </div>
  )
}
