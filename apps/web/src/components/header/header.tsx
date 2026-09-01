import { useReactFlow, type XYPosition } from '@xyflow/react'
import { useCallback } from 'react'
import { generateNodeId } from '@/utils/crypto/crypto.utils'
import { DesktopMenu } from './desktop-menu'
import { MobileMenu } from './mobile-menu'
import type { NodeType } from '@/types/node'

interface HeaderProps {
  showNodeMenu?: boolean
}

export const Header = ({ showNodeMenu = false }: HeaderProps) => {
  const { screenToFlowPosition, setNodes } = useReactFlow()

  const handleNodeDrop = useCallback(
    (nodeType: NodeType, screenPosition: XYPosition) => {
      const flow = document.querySelector('.react-flow')
      const flowRect = flow?.getBoundingClientRect()
      const isInFlow =
        flowRect &&
        screenPosition.x >= flowRect.left &&
        screenPosition.x <= flowRect.right &&
        screenPosition.y >= flowRect.top &&
        screenPosition.y <= flowRect.bottom

      if (isInFlow) {
        const position = screenToFlowPosition(screenPosition)
        const newNode = {
          id: generateNodeId(),
          type: nodeType,
          position,
          data: {},
        }
        setNodes((nds) => nds.concat(newNode))
      }
    },
    [setNodes, screenToFlowPosition]
  )

  return (
    <header className="flex border-b-2 rounded-b-[20px] relative z-9999 border-border w-full items-center bg-sidebar px-8 py-4 justify-between text-foreground">
      <div className="flex items-center gap-2">
        <img src="/logo-light.png" alt="logo" className="w-10 h-10" />
        <h1 className="font-mono">PLGRND</h1>
      </div>
      {showNodeMenu && <DesktopMenu onDrop={handleNodeDrop} />}
      {showNodeMenu && <MobileMenu onDrop={handleNodeDrop} />}
    </header>
  )
}
