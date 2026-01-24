'use client'

import { useRef, useCallback } from 'react'
import type { NodeProps } from 'reactflow'
import { useReactFlow } from 'reactflow'
import type { MeshSourceNodeData, AppNode, AppEdge } from '@/types/nodes'
import { NODE_TYPES } from '@/types/nodes'
import { BaseNode } from './BaseNode'
import { meshSourceDefinition } from '@/lib/nodes/registry'
import { loadMeshFile, getAcceptedExtensions } from '@/lib/loaders/meshLoader'
import { useMeshStore } from '@/stores/meshStore'
import { getSampleDefinitions, generateSampleMesh } from '@/lib/samples/generateSamples'

export function MeshSourceNode({ id, data, selected }: NodeProps<MeshSourceNodeData>) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { setNodes, addNodes, addEdges, getNode, getNodes } = useReactFlow()
  const addMesh = useMeshStore((state) => state.addMesh)

  // Find a non-overlapping position for a new node
  const findNonOverlappingPosition = useCallback((baseX: number, baseY: number) => {
    const nodes = getNodes()
    const nodeWidth = 250
    const nodeHeight = 300
    const padding = 50

    let x = baseX
    let y = baseY
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      const overlaps = nodes.some((n) => {
        const dx = Math.abs(n.position.x - x)
        const dy = Math.abs(n.position.y - y)
        return dx < nodeWidth + padding && dy < nodeHeight + padding
      })

      if (!overlaps) break

      if (attempts % 2 === 0) {
        y += nodeHeight + padding
      } else {
        x += nodeWidth + padding
        y = baseY
      }
      attempts++
    }

    return { x, y }
  }, [getNodes])

  const updateNodeData = useCallback(
    (updates: Partial<MeshSourceNodeData>) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === id) {
            return { ...node, data: { ...node.data, ...updates } }
          }
          return node
        })
      )
    },
    [id, setNodes]
  )

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      // Set loading state
      updateNodeData({ status: 'running', error: null })

      try {
        const meshId = `mesh-${id}-${Date.now()}`
        const meshData = await loadMeshFile(file, meshId)

        // Add mesh to store
        addMesh(meshData)

        // Update node data
        updateNodeData({
          status: 'pass',
          meshId: meshData.id,
          meshName: meshData.name,
          error: null,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load mesh'
        updateNodeData({
          status: 'error',
          meshId: null,
          meshName: null,
          error: errorMessage,
        })
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [id, updateNodeData, addMesh]
  )

  const handleLoadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleSampleSelect = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const sampleId = event.target.value
      if (!sampleId) return

      // Set loading state
      updateNodeData({ status: 'running', error: null })

      try {
        const meshData = generateSampleMesh(sampleId)

        if (!meshData) {
          throw new Error(`Unknown sample: ${sampleId}`)
        }

        // Generate unique ID for this instance
        const uniqueMesh = {
          ...meshData,
          id: `${meshData.id}-${id}-${Date.now()}`,
        }

        // Add mesh to store
        addMesh(uniqueMesh)

        // Update node data
        updateNodeData({
          status: 'pass',
          meshId: uniqueMesh.id,
          meshName: meshData.name,
          error: null,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load sample'
        updateNodeData({
          status: 'error',
          meshId: null,
          meshName: null,
          error: errorMessage,
        })
      }

      // Reset select
      event.target.value = ''
    },
    [id, updateNodeData, addMesh]
  )

  const sampleDefinitions = getSampleDefinitions()

  // Handle creating ModelViewerNode
  const handleGo = useCallback(() => {
    if (!data.meshId) return

    const thisNode = getNode(id) as AppNode
    if (!thisNode) return

    const position = findNonOverlappingPosition(thisNode.position.x + 350, thisNode.position.y)
    const newNodeId = `model-viewer-${Date.now()}`
    const newNode: AppNode = {
      id: newNodeId,
      type: NODE_TYPES.MODEL_VIEWER,
      position,
      data: {
        label: '3D Model',
        status: 'pass',
        meshId: data.meshId,
        meshName: data.meshName,
        error: null,
      },
    }

    const newEdge: AppEdge = {
      id: `edge-${id}-${newNodeId}`,
      source: id,
      sourceHandle: 'mesh',
      target: newNodeId,
      targetHandle: 'mesh',
    }

    addNodes([newNode])
    addEdges([newEdge])
  }, [id, data.meshId, data.meshName, getNode, addNodes, addEdges, findNonOverlappingPosition])

  return (
    <BaseNode
      label={data.label}
      status={data.status}
      inputs={meshSourceDefinition.inputs}
      outputs={meshSourceDefinition.outputs}
      selected={selected}
    >
      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={getAcceptedExtensions()}
          onChange={handleFileSelect}
          className="hidden"
          data-testid="mesh-file-input"
        />

        <button
          onClick={handleLoadClick}
          disabled={data.status === 'running'}
          className="w-full px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:cursor-not-allowed rounded transition-colors"
        >
          {data.status === 'running' ? 'Loading...' : 'Load File'}
        </button>

        <select
          className="w-full px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded cursor-pointer transition-colors disabled:cursor-not-allowed disabled:bg-neutral-800"
          onChange={handleSampleSelect}
          disabled={data.status === 'running'}
          defaultValue=""
          data-testid="sample-mesh-select"
        >
          <option value="" disabled>
            Load sample mesh...
          </option>
          {sampleDefinitions.map((sample) => (
            <option key={sample.id} value={sample.id}>
              {sample.name}
            </option>
          ))}
        </select>

        <div className="text-xs">
          {data.error ? (
            <span className="text-red-400">{data.error}</span>
          ) : data.meshName ? (
            <div className="space-y-1">
              <span className="text-blue-400 block truncate" title={data.meshName}>
                {data.meshName}
              </span>
            </div>
          ) : (
            <span className="text-gray-400">No mesh loaded</span>
          )}
        </div>

        {/* Go button - creates ModelViewerNode */}
        <button
          onClick={handleGo}
          disabled={!data.meshId || data.status === 'running'}
          className="w-full mt-2 px-3 py-1.5 text-xs font-medium bg-white text-neutral-900 hover:bg-blue-500 hover:text-white disabled:bg-neutral-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded transition-colors"
        >
          Go
        </button>
      </div>
    </BaseNode>
  )
}
