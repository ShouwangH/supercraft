'use client'

import { useState } from 'react'
import { NodeCanvas, createInitialNodes } from '@/components/canvas/NodeCanvas'
import { Inspector } from '@/components/ui/Inspector'
import type { AppNode, AppEdge } from '@/types/nodes'

export default function Home() {
  const { nodes: initialNodes, edges: initialEdges } = createInitialNodes()
  const [nodes, setNodes] = useState<AppNode[]>(initialNodes)

  return (
    <main className="flex h-screen w-screen overflow-hidden">
      {/* Node Graph Canvas */}
      <div className="flex-1 h-full">
        <NodeCanvas
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          onNodesChange={setNodes}
        />
      </div>

      {/* Inspector Panel */}
      <div className="w-80 h-full">
        <Inspector nodes={nodes} />
      </div>
    </main>
  )
}
