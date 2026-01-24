'use client'

import { useCallback, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type NodeTypes,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { getRegisteredNodeTypes, isValidConnection, getNodeDefinition } from '@/lib/nodes/registry'
import { useUIStore } from '@/stores/uiStore'
import type { AppNode, AppEdge } from '@/types/nodes'

// Import to register nodes
import '@/components/nodes'

interface NodeCanvasProps {
  initialNodes?: AppNode[]
  initialEdges?: AppEdge[]
  onNodesChange?: (nodes: AppNode[]) => void
  onEdgesChange?: (edges: AppEdge[]) => void
}

export function NodeCanvas({
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onEdgesChange,
}: NodeCanvasProps) {
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges)
  const setSelectedNodeId = useUIStore((state) => state.setSelectedNodeId)

  // Get registered node types for React Flow
  const nodeTypes: NodeTypes = useMemo(() => getRegisteredNodeTypes(), [])

  const handleConnect = useCallback(
    (connection: Connection) => {
      // Validate connection types match
      if (connection.source && connection.target && connection.sourceHandle && connection.targetHandle) {
        const sourceNode = nodes.find((n) => n.id === connection.source)
        const targetNode = nodes.find((n) => n.id === connection.target)

        if (sourceNode && targetNode) {
          const isValid = isValidConnection(
            sourceNode.type || '',
            connection.sourceHandle,
            targetNode.type || '',
            connection.targetHandle
          )

          if (!isValid) {
            console.warn('Invalid connection: port types do not match')
            return
          }
        }
      }

      setEdges((eds) => addEdge(connection, eds))
    },
    [nodes, setEdges]
  )

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: AppNode[] }) => {
      if (selectedNodes.length === 1) {
        setSelectedNodeId(selectedNodes[0].id)
      } else {
        setSelectedNodeId(null)
      }
    },
    [setSelectedNodeId]
  )

  // Notify parent of changes
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeInternal>[0]) => {
      onNodesChangeInternal(changes)
      if (onNodesChange) {
        // Get updated nodes after changes applied
        setNodes((currentNodes) => {
          onNodesChange(currentNodes as AppNode[])
          return currentNodes
        })
      }
    },
    [onNodesChangeInternal, onNodesChange, setNodes]
  )

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChangeInternal>[0]) => {
      onEdgesChangeInternal(changes)
      if (onEdgesChange) {
        setEdges((currentEdges) => {
          onEdgesChange(currentEdges)
          return currentEdges
        })
      }
    },
    [onEdgesChangeInternal, onEdgesChange, setEdges]
  )

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onSelectionChange={handleSelectionChange}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          style: { stroke: '#3b82f6', strokeWidth: 2 },
        }}
        defaultViewport={{ x: 50, y: 50, zoom: 0.85 }}
        minZoom={0.3}
        maxZoom={1.5}
        className="bg-neutral-900"
      >
        <Background color="#333" gap={16} />
        <Controls className="!bg-neutral-800 !border-neutral-600" />
      </ReactFlow>
    </div>
  )
}

// Helper to create initial nodes - only MeshSourceNode at start
export function createInitialNodes(): { nodes: AppNode[]; edges: AppEdge[] } {
  const nodes: AppNode[] = [
    {
      id: 'mesh-source-1',
      type: 'mesh-source',
      position: { x: 100, y: 100 },
      data: { label: 'Mesh Source', status: 'idle', meshId: null, meshName: null, error: null },
    },
  ]

  // No initial edges - nodes created dynamically via button clicks
  const edges: AppEdge[] = []

  return { nodes, edges }
}
