'use client'

import type { NodeProps } from 'reactflow'
import type { SuggestedFixesNodeData } from '@/types/nodes'
import { BaseNode } from './BaseNode'
import { suggestedFixesDefinition } from '@/lib/nodes/registry'

export function SuggestedFixesNode({ data, selected }: NodeProps<SuggestedFixesNodeData>) {
  return (
    <BaseNode
      label={data.label}
      status={data.status}
      inputs={suggestedFixesDefinition.inputs}
      outputs={suggestedFixesDefinition.outputs}
      selected={selected}
    >
      <div className="text-xs text-gray-400">
        {data.fixPlanId ? (
          <span className="text-purple-400">Fixes available</span>
        ) : (
          <span>Connect mesh &amp; report</span>
        )}
      </div>
    </BaseNode>
  )
}
