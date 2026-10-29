import type { Position } from '@xyflow/react'

export type NodeActionConfigBase = {
  position: Position
  label: string
}

export type NodeActionConfig = NodeActionConfigBase & {
  onClick: () => void
  disabled?: boolean
}
