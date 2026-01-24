'use client'

import { NodeCanvas, createInitialNodes } from '@/components/canvas/NodeCanvas'

export default function Home() {
  const { nodes: initialNodes, edges: initialEdges } = createInitialNodes()

  return (
    <main className="h-screen w-screen overflow-hidden bg-neutral-900">
      <NodeCanvas
        initialNodes={initialNodes}
        initialEdges={initialEdges}
      />
    </main>
  )
}
