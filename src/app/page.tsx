'use client'

import { useState } from 'react'
import { NodeCanvas, createInitialNodes } from '@/components/canvas/NodeCanvas'
import { Inspector } from '@/components/ui/Inspector'
import { MeshViewer, ViewerControls } from '@/components/viewer'
import type { AppNode } from '@/types/nodes'

export default function Home() {
  const { nodes: initialNodes, edges: initialEdges } = createInitialNodes()
  const [nodes, setNodes] = useState<AppNode[]>(initialNodes)

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-neutral-900">
      {/* Main content area */}
      <div className="flex-1 flex flex-col h-full">
        {/* Node Graph Canvas - top half */}
        <div className="flex-1 min-h-0 border-b border-neutral-700">
          <NodeCanvas
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            onNodesChange={setNodes}
          />
        </div>

        {/* 3D Viewer - bottom half */}
        <div className="flex-1 min-h-0 relative">
          <MeshViewer />
          <ViewerControls />
        </div>
      </div>

      {/* Inspector Panel - right side */}
      <div className="w-80 h-full flex-shrink-0">
        <Inspector nodes={nodes} />
      </div>
    </main>
  )
}
