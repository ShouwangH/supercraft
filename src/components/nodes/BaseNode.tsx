'use client'

import { Handle, Position } from 'reactflow'
import type { NodeStatus, PortDefinition } from '@/types/nodes'

interface BaseNodeProps {
  label: string
  status: NodeStatus
  inputs: PortDefinition[]
  outputs: PortDefinition[]
  selected?: boolean
  children?: React.ReactNode
  onRun?: () => void
}

const statusColors: Record<NodeStatus, string> = {
  idle: 'bg-gray-500',
  running: 'bg-blue-500 animate-pulse',
  pass: 'bg-green-500',
  warn: 'bg-yellow-500',
  fail: 'bg-red-500',
  error: 'bg-red-700',
}

const statusLabels: Record<NodeStatus, string> = {
  idle: 'IDLE',
  running: 'RUN',
  pass: 'PASS',
  warn: 'WARN',
  fail: 'FAIL',
  error: 'ERR',
}

export function BaseNode({
  label,
  status,
  inputs,
  outputs,
  selected,
  children,
  onRun,
}: BaseNodeProps) {
  return (
    <div
      className={`
        bg-neutral-800 rounded-lg border-2 min-w-[180px]
        ${selected ? 'border-blue-500' : 'border-neutral-600'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-600">
        <span className="text-sm font-medium text-white truncate">{label}</span>
        <div className="flex items-center gap-2">
          <span
            className={`
              px-2 py-0.5 text-xs font-bold rounded
              ${statusColors[status]} text-white
            `}
          >
            {statusLabels[status]}
          </span>
          {onRun && (
            <button
              onClick={onRun}
              className="p-1 hover:bg-neutral-700 rounded text-white"
              title="Run"
            >
              ▶
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3">{children}</div>

      {/* Input handles */}
      {inputs.map((input, index) => (
        <Handle
          key={input.id}
          type="target"
          position={Position.Left}
          id={input.id}
          style={{ top: 60 + index * 24 }}
          className="!w-3 !h-3 !bg-blue-400 !border-2 !border-neutral-800"
        />
      ))}

      {/* Output handles */}
      {outputs.map((output, index) => (
        <Handle
          key={output.id}
          type="source"
          position={Position.Right}
          id={output.id}
          style={{ top: 60 + index * 24 }}
          className="!w-3 !h-3 !bg-green-400 !border-2 !border-neutral-800"
        />
      ))}
    </div>
  )
}
