import { DraggableNode } from '@/components/node-select/draggable-node'
import { menuConfig } from '@/constants/menu-config'
import type { NodeType } from '@/types/node'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import { useState } from 'react'

interface DesktopMenuProps {
  onDrop: (nodeType: NodeType, screen: { x: number; y: number }) => void
}

export function DesktopMenu({ onDrop }: DesktopMenuProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | undefined>(undefined)

  const handleDragStart = (categoryId: string) => {
    setIsDragging(true)
    setOpenMenu(categoryId)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    setTimeout(() => {
      if (!isDragging) {
        setOpenMenu(undefined)
      }
    }, 100)
  }

  return (
    <NavigationMenu
      viewport={false}
      className="hidden md:block"
      value={isDragging ? openMenu : undefined}
      onValueChange={(value) => {
        if (!isDragging) {
          setOpenMenu(value)
        }
      }}
    >
      <NavigationMenuList className="gap-4">
        {menuConfig.map((category) => (
          <NavigationMenuItem key={category.id} value={category.id}>
            <div className="relative border-border border rounded-t-[6px]">
              <NavigationMenuTrigger className="cursor-pointer relative z-30 ">
                <p className="text-sm font-medium text-foreground">{category.label}</p>
              </NavigationMenuTrigger>
              <div
                className="absolute -bottom-1 z-20 left-0 right-0 h-3 rounded-b-[6px]"
                style={{ backgroundColor: category.color }}
              />
            </div>
            <NavigationMenuContent className="overflow-visible! p-0 border-none ">
              <div className="grid grid-cols-1 gap-2 p-4 w-[200px] bg-card rounded-[8px] border border-border">
                {category.nodes.map((nodeType) => (
                  <div key={nodeType} className="relative">
                    <DraggableNode
                      type={nodeType}
                      onDrop={onDrop}
                      onDragStart={() => handleDragStart(category.id)}
                      onDragEnd={handleDragEnd}
                    />
                  </div>
                ))}
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
