import type { NodeType } from '@/types/node'
import type { XYPosition } from '@xyflow/react'
import { useRef, useState, type RefObject } from 'react'
import { useDraggable } from '@neodrag/react'
import { cn } from '@/lib/utils'
import { getNodeStyles } from '@/utils/node/node-style.utils'
import { getNodeConfig } from '@/utils/node/node-config-registry'

export interface DraggableNodeProps {
  type: NodeType
  onDrop: (nodeType: NodeType, position: XYPosition) => void
  onDragStart?: () => void
  onDragEnd?: () => void
  className?: string
}

export const DraggableNode = ({ type, onDrop, onDragStart, onDragEnd, className }: DraggableNodeProps) => {
  const draggableRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<XYPosition>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  useDraggable(draggableRef as RefObject<HTMLElement>, {
    position: position,
    onDragStart: () => {
      setIsDragging(true)
      onDragStart?.()
    },
    onDrag: ({ offsetX, offsetY }) => {
      // Calculate position relative to the viewport
      setPosition({
        x: offsetX,
        y: offsetY,
      })
    },
    onDragEnd: ({ event }) => {
      setIsDragging(false)
      setPosition({ x: 0, y: 0 })
      onDrop(type, {
        x: event.clientX,
        y: event.clientY,
      })
      onDragEnd?.()
    },
  })

  const nodeConfig = getNodeConfig(type as NodeType)

  const nodeStyles = getNodeStyles(type)

  const handleClick = () => {
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    onDrop(type, { x: centerX, y: centerY })
  }

  return (
    <>
      <div
        ref={draggableRef}
        onClick={handleClick}
        className={cn('dndnode pointer-events-auto', isDragging && 'fixed', className)}
        style={{ zIndex: isDragging ? 99999 : undefined }}
      >
        <div className="relative border-border md:w-[180px] border rounded-t-[6px]">
          <div className="cursor-grab active:cursor-grabbing relative z-30 group inline-flex h-9 w-full items-center justify-center rounded-md bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-border">
            <p className="text-sm font-medium text-foreground capitalize text-center">
              {nodeConfig.label.toLowerCase()}
            </p>
          </div>
          <div
            className="absolute -bottom-1 z-20 left-0 right-0 h-3 rounded-b-[6px]"
            style={{ backgroundColor: nodeStyles.color }}
          />
        </div>
      </div>
    </>
  )
}
