'use client'

import type { NodeProps } from 'reactflow'
import type { PrintabilityReportNodeData } from '@/types/nodes'
import { BaseNode } from './BaseNode'
import { printabilityReportDefinition } from '@/lib/nodes/registry'

export function PrintabilityReportNode({ data, selected }: NodeProps<PrintabilityReportNodeData>) {
  const handleRun = () => {
    // Will be implemented in PR 8
    console.log('Run analysis')
  }

  return (
    <BaseNode
      label={data.label}
      status={data.status}
      inputs={printabilityReportDefinition.inputs}
      outputs={printabilityReportDefinition.outputs}
      selected={selected}
      onRun={handleRun}
    >
      <div className="text-xs text-gray-400">
        {data.reportId ? (
          <span className="text-blue-400">Report ready</span>
        ) : (
          <span>Connect mesh to analyze</span>
        )}
      </div>
    </BaseNode>
  )
}
