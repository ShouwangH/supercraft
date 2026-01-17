'use client'

import { useUIStore } from '@/stores/uiStore'
import { getNodeDefinition } from '@/lib/nodes/registry'
import type { AppNode } from '@/types/nodes'

interface InspectorProps {
  nodes: AppNode[]
}

export function Inspector({ nodes }: InspectorProps) {
  const selectedNodeId = useUIStore((state) => state.selectedNodeId)

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : null

  const nodeDefinition = selectedNode?.type
    ? getNodeDefinition(selectedNode.type)
    : null

  if (!selectedNode) {
    return (
      <div className="h-full bg-neutral-800 border-l border-neutral-700 p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Inspector</h2>
        <p className="text-sm text-gray-400">Select a node to view details</p>
      </div>
    )
  }

  return (
    <div className="h-full bg-neutral-800 border-l border-neutral-700 p-4 overflow-y-auto">
      <h2 className="text-lg font-semibold text-white mb-4">Inspector</h2>

      {/* Node Info */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Node</h3>
        <div className="bg-neutral-700 rounded p-3">
          <div className="text-sm">
            <span className="text-gray-400">Type:</span>{' '}
            <span className="text-white">{nodeDefinition?.label || selectedNode.type}</span>
          </div>
          <div className="text-sm mt-1">
            <span className="text-gray-400">ID:</span>{' '}
            <span className="text-white font-mono text-xs">{selectedNode.id}</span>
          </div>
        </div>
      </div>

      {/* Inputs */}
      {nodeDefinition && nodeDefinition.inputs.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Inputs</h3>
          <div className="space-y-2">
            {nodeDefinition.inputs.map((input) => (
              <div
                key={input.id}
                className="bg-neutral-700 rounded p-2 flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-sm text-white">{input.label}</span>
                <span className="text-xs text-gray-500">({input.type})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outputs */}
      {nodeDefinition && nodeDefinition.outputs.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Outputs</h3>
          <div className="space-y-2">
            {nodeDefinition.outputs.map((output) => (
              <div
                key={output.id}
                className="bg-neutral-700 rounded p-2 flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-sm text-white">{output.label}</span>
                <span className="text-xs text-gray-500">({output.type})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Data</h3>
        <pre className="bg-neutral-700 rounded p-3 text-xs text-gray-300 overflow-x-auto">
          {JSON.stringify(selectedNode.data, null, 2)}
        </pre>
      </div>
    </div>
  )
}
