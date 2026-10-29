import { useTypedReactFlow } from '@/hooks/flow/use-typed-react-flow'
import { CustomNode } from '../../ui/custom-node'
import { useRef, useState } from 'react'
import type { TextNodeType, TextNodeData } from '@/types/nodes/input/text-node'
import { Input } from '../../ui/input'
import { getNodeStyles } from '@/utils/node/node-style.utils'
import type { NodeProps } from '@xyflow/react'
import { useBlurOnOutsideClick } from '@/hooks/use-blur-on-outside-click'
import { useFlowMode } from '@/components/flow/flow-mode-context'
import { swapSignerForWallet } from '@/utils/flow/swap-signer'
import { generateNodeId } from '@/utils/crypto/crypto.utils'
import { Wallet as WalletIcon } from 'lucide-react'

export const TextNode = (props: NodeProps<TextNodeType>) => {
  const [text, setText] = useState(props.data.text)
  const { updateNodeData, getNodes, getEdges, setNodes, setEdges } = useTypedReactFlow()
  const { mode } = useFlowMode()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useBlurOnOutsideClick(containerRef, inputRef)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value)
    updateNodeData<TextNodeData>(props.id, { text: e.target.value })
  }

  const switchToWallet = () => {
    const swapped = swapSignerForWallet(getNodes(), getEdges(), props.id, generateNodeId())
    setNodes(swapped.nodes)
    setEdges(swapped.edges)
  }

  const nodeStyles = getNodeStyles(props.type)
  return (
    <CustomNode {...props}>
      <div ref={containerRef}>
        <Input ref={inputRef} value={text} color={nodeStyles.color} onChange={handleChange} />
        {props.data.signer && mode === 'editor' && (
          <button
            type="button"
            onClick={switchToWallet}
            className="mt-1.5 flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[9px] font-mono text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <WalletIcon className="w-2.5 h-2.5" />
            Use my wallet
          </button>
        )}
      </div>
    </CustomNode>
  )
}
