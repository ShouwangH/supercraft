'use client'

import { useRef, useCallback } from 'react'
import type { NodeProps } from 'reactflow'
import { useReactFlow } from 'reactflow'
import type { MeshSourceNodeData } from '@/types/nodes'
import { BaseNode } from './BaseNode'
import { meshSourceDefinition } from '@/lib/nodes/registry'
import { loadMeshFile, getAcceptedExtensions } from '@/lib/loaders/meshLoader'
import { useMeshStore } from '@/stores/meshStore'

export function MeshSourceNode({ id, data, selected }: NodeProps<MeshSourceNodeData>) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { setNodes } = useReactFlow()
  const addMesh = useMeshStore((state) => state.addMesh)

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
          className="w-full px-2 py-1 text-xs bg-neutral-700 rounded"
          disabled
          defaultValue=""
        >
          <option value="" disabled>
            Sample meshes (coming soon)
          </option>
        </select>

        <div className="text-xs">
          {data.error ? (
            <span className="text-red-400">{data.error}</span>
          ) : data.meshName ? (
            <div className="space-y-1">
              <span className="text-green-400 block truncate" title={data.meshName}>
                {data.meshName}
              </span>
            </div>
          ) : (
            <span className="text-gray-400">No mesh loaded</span>
          )}
        </div>
      </div>
    </BaseNode>
  )
}
