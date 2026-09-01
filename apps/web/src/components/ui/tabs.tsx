import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

import { cn } from '@/lib/utils'

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-2', className)} {...props} />
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'inline-flex w-fit items-center justify-center gap-1 rounded-md border border-border bg-background p-1',
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex cursor-pointer items-center justify-center rounded-sm px-3 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground',
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn('outline-none', className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
