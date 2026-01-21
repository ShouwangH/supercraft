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

const statusColors: Record<NodeStatus, { bg: string; text: string; glow: string }> = {
  idle: { bg: 'bg-neutral-600', text: 'text-gray-300', glow: '' },
  running: { bg: 'bg-blue-500', text: 'text-white', glow: 'shadow-blue-500/50' },
  pass: { bg: 'bg-emerald-500', text: 'text-white', glow: 'shadow-emerald-500/50' },
  warn: { bg: 'bg-amber-500', text: 'text-black', glow: 'shadow-amber-500/50' },
  fail: { bg: 'bg-red-500', text: 'text-white', glow: 'shadow-red-500/50' },
  error: { bg: 'bg-red-700', text: 'text-white', glow: 'shadow-red-700/50' },
}

const statusLabels: Record<NodeStatus, string> = {
  idle: 'IDLE',
  running: 'RUN',
  pass: 'PASS',
  warn: 'WARN',
  fail: 'FAIL',
  error: 'ERR',
}

/** Get port color based on type */
function getPortColor(type: string): string {
  switch (type) {
    case 'mesh':
      return '!bg-cyan-400'
    case 'report':
      return '!bg-amber-400'
    case 'fix_plan':
      return '!bg-purple-400'
    default:
      return '!bg-blue-400'
  }
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
  const statusStyle = statusColors[status]

  return (
    <div
      className={`
        bg-gradient-to-b from-neutral-800 to-neutral-850
        rounded-lg min-w-[200px] shadow-xl
        transition-all duration-200
        ${selected
          ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-900 shadow-blue-500/20'
          : 'ring-1 ring-neutral-600 hover:ring-neutral-500'
        }
      `}
    >
      {/* Header with gradient */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-neutral-700/50 to-neutral-800/50 rounded-t-lg border-b border-neutral-600/50">
        <div className="flex items-center gap-2 min-w-0">
          {/* Status indicator dot */}
          <div
            className={`
              w-2.5 h-2.5 rounded-full flex-shrink-0
              ${statusStyle.bg}
              ${status === 'running' ? 'animate-pulse' : ''}
              ${statusStyle.glow ? `shadow-md ${statusStyle.glow}` : ''}
            `}
          />
          <span className="text-sm font-semibold text-white truncate">{label}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`
              px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wide
              ${statusStyle.bg} ${statusStyle.text}
              ${status === 'running' ? 'animate-pulse' : ''}
            `}
          >
            {statusLabels[status]}
          </span>
          {onRun && (
            <button
              onClick={onRun}
              className="w-6 h-6 flex items-center justify-center rounded-md bg-neutral-600 hover:bg-neutral-500 text-white transition-colors text-sm"
              title="Run"
            >
              ▶
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3">{children}</div>

      {/* Input handles with labels */}
      {inputs.map((input, index) => (
        <div key={input.id}>
          <Handle
            type="target"
            position={Position.Left}
            id={input.id}
            style={{ top: 60 + index * 28 }}
            className={`!w-3 !h-3 ${getPortColor(input.type)} !border-2 !border-neutral-900 hover:!scale-125 transition-transform`}
          />
          <span
            className="absolute text-[9px] text-gray-400 font-medium"
            style={{ left: 16, top: 54 + index * 28 }}
          >
            {input.label}
          </span>
        </div>
      ))}

      {/* Output handles with labels */}
      {outputs.map((output, index) => (
        <div key={output.id}>
          <Handle
            type="source"
            position={Position.Right}
            id={output.id}
            style={{ top: 60 + index * 28 }}
            className={`!w-3 !h-3 ${getPortColor(output.type)} !border-2 !border-neutral-900 hover:!scale-125 transition-transform`}
          />
          <span
            className="absolute text-[9px] text-gray-400 font-medium text-right"
            style={{ right: 16, top: 54 + index * 28 }}
          >
            {output.label}
          </span>
        </div>
      ))}
    </div>
  )
}
