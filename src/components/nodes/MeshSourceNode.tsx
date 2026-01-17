'use client'

import type { NodeProps } from 'reactflow'
import type { MeshSourceNodeData } from '@/types/nodes'
import { BaseNode } from './BaseNode'
import { meshSourceDefinition } from '@/lib/nodes/registry'

export function MeshSourceNode({ data, selected }: NodeProps<MeshSourceNodeData>) {
  return (
    <BaseNode
      label={data.label}
      status={data.status}
      inputs={meshSourceDefinition.inputs}
      outputs={meshSourceDefinition.outputs}
      selected={selected}
    >
      <div className="text-xs text-gray-400">
        {data.meshName ? (
          <span className="text-green-400">{data.meshName}</span>
        ) : (
          <span>No mesh loaded</span>
        )}
      </div>
    </BaseNode>
  )
}
