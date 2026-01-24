'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NodeProps } from 'reactflow'
import { useReactFlow, useEdges } from 'reactflow'
import { Handle, Position } from 'reactflow'
import type { PrintabilityReportNodeData, AppNode, AppEdge } from '@/types/nodes'
import { NODE_TYPES } from '@/types/nodes'
import { printabilityReportDefinition } from '@/lib/nodes/registry'
import { useMeshStore } from '@/stores/meshStore'
import { useReportStore } from '@/stores/reportStore'
import type { Issue } from '@/types/report'

/**
 * Maps issue severity to CSS color class
 */
function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'BLOCKER':
      return 'text-red-400'
    case 'RISK':
      return 'text-yellow-400'
    case 'INFO':
      return 'text-blue-400'
    default:
      return 'text-gray-400'
  }
}

/**
 * Compact issue display
 */
function IssueItem({ issue }: { issue: Issue }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`font-medium ${getSeverityColor(issue.severity)}`}>
        {issue.severity}
      </span>
      <span className="text-gray-300 truncate">{issue.title}</span>
    </div>
  )
}

export function PrintabilityReportNode({ id, data, selected }: NodeProps<PrintabilityReportNodeData>) {
  const { getNode, getNodes, addNodes, addEdges, setNodes, setEdges } = useReactFlow()
  const edges = useEdges()
  const getMesh = useMeshStore((state) => state.getMesh)
  const { setReport, setAnalyzing, setError } = useReportStore()
  // Subscribe to reports directly for reactivity
  const reports = useReportStore((state) => state.reports)
  const hasAutoRun = useRef(false)
  const [isAnalyzing, setIsAnalyzingLocal] = useState(false)

  // Delete this node and its connected edges
  const handleDelete = useCallback(() => {
    setNodes((nodes) => nodes.filter((n) => n.id !== id))
    setEdges((edges) => edges.filter((e) => e.source !== id && e.target !== id))
  }, [id, setNodes, setEdges])

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

  // Use the meshId that was set when this node was created
  // This ensures each node in a workflow uses its specific mesh, not a dynamically looked-up one
  const connectedMeshId = data.meshId

  // Get the report if it exists (using direct subscription for reactivity)
  const report = useMemo(() => {
    if (!connectedMeshId) return null
    return reports[connectedMeshId] || null
  }, [connectedMeshId, reports])

  // Run analysis
  const runAnalysis = useCallback(async () => {
    if (!connectedMeshId) return

    const mesh = getMesh(connectedMeshId)
    if (!mesh) {
      setError(connectedMeshId, 'Mesh not found')
      return
    }

    setIsAnalyzingLocal(true)
    setAnalyzing(connectedMeshId, true)
    setError(connectedMeshId, null)

    try {
      const response = await fetch('/api/printability/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesh: {
            positions: Array.from(mesh.positions),
            indices: Array.from(mesh.indices),
            normals: mesh.normals ? Array.from(mesh.normals) : undefined,
          },
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Analysis failed')
      }

      setReport(connectedMeshId, result.report)
    } catch (error) {
      setError(
        connectedMeshId,
        error instanceof Error ? error.message : 'Analysis failed'
      )
    } finally {
      setIsAnalyzingLocal(false)
      setAnalyzing(connectedMeshId, false)
    }
  }, [connectedMeshId, getMesh, setAnalyzing, setError, setReport])

  // Auto-run analysis when connected to mesh
  useEffect(() => {
    if (connectedMeshId && !report && !hasAutoRun.current && !isAnalyzing) {
      hasAutoRun.current = true
      runAnalysis()
    }
  }, [connectedMeshId, report, isAnalyzing, runAnalysis])

  // Handle creating SuggestedFixesNode
  const handleCreateFixes = useCallback(() => {
    if (!report || !connectedMeshId) return

    const thisNode = getNode(id) as AppNode
    if (!thisNode) return

    const position = findNonOverlappingPosition(thisNode.position.x + 350, thisNode.position.y)
    const newNodeId = `suggested-fixes-${Date.now()}`
    const newNode: AppNode = {
      id: newNodeId,
      type: NODE_TYPES.SUGGESTED_FIXES,
      position,
      data: {
        label: 'Suggested Fixes',
        status: 'idle',
        meshId: connectedMeshId,
        fixPlanId: null,
        generating: false,
        applyingFix: null,
        error: null,
      },
    }

    const meshEdge: AppEdge = {
      id: `edge-mesh-${id}-${newNodeId}`,
      source: id,
      sourceHandle: 'report',
      target: newNodeId,
      targetHandle: 'report',
    }

    addNodes([newNode])
    addEdges([meshEdge])
  }, [id, report, connectedMeshId, getNode, addNodes, addEdges, findNonOverlappingPosition])

  // Determine border color based on status
  const getBorderColor = () => {
    if (selected) return 'border-blue-500 shadow-lg shadow-blue-500/20'
    if (isAnalyzing) return 'border-blue-500'
    if (data.error) return 'border-red-500'
    if (report?.status === 'FAIL') return 'border-red-500'
    if (report?.status === 'WARN') return 'border-yellow-500'
    if (report?.status === 'PASS') return 'border-blue-500'
    return 'border-neutral-600'
  }

  return (
    <div
      className={`bg-neutral-800 rounded-lg border-2 min-w-[200px] transition-all ${getBorderColor()}`}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="mesh"
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-neutral-800"
      />

      {/* Header */}
      <div className="px-3 py-2 border-b border-neutral-700 relative">
        <div className="text-sm font-medium text-white pr-6">{data.label}</div>
        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleDelete()
          }}
          className="absolute top-2 right-2 p-1 text-gray-500 hover:text-red-400 transition-colors"
          title="Delete node"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Loading state */}
        {isAnalyzing && (
          <div className="space-y-2">
            <div className="text-xs text-blue-400 animate-pulse">Analyzing mesh...</div>
            <div className="w-full h-1 bg-neutral-700 rounded overflow-hidden">
              <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* Error state */}
        {data.error && (
          <div className="text-xs text-red-400">{data.error}</div>
        )}

        {/* Report results */}
        {report && !isAnalyzing && (
          <>
            {/* Stats */}
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Triangles:</span>
                <span className="text-gray-200">{report.meshStats.triangleCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Components:</span>
                <span className="text-gray-200">{report.meshStats.componentCount}</span>
              </div>
            </div>

            {/* Issues */}
            {report.issues.length > 0 ? (
              <div className="pt-2 border-t border-neutral-700 space-y-1">
                <div className="text-xs font-medium text-gray-300">
                  Issues ({report.issues.length})
                </div>
                <div className="space-y-1 max-h-[120px] overflow-y-auto">
                  {report.issues.map((issue) => (
                    <IssueItem key={issue.id} issue={issue} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-blue-400 pt-2 border-t border-neutral-700">
                No issues found
              </div>
            )}
          </>
        )}

        {/* No mesh connected */}
        {!connectedMeshId && !isAnalyzing && (
          <div className="text-xs text-gray-400">Connect mesh to analyze</div>
        )}
      </div>

      {/* AI Fixes button - always at bottom when report exists */}
      {report && !isAnalyzing && (
        <div className="px-3 pb-3">
          <button
            onClick={handleCreateFixes}
            className="w-full px-3 py-1.5 text-xs font-medium bg-white text-neutral-900 hover:bg-blue-500 hover:text-white rounded transition-colors flex items-center justify-center gap-1.5"
            title="Generate AI-powered fix suggestions"
          >
            <span>✨</span>
            <span>AI Fixes</span>
          </button>
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="report"
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-neutral-800"
      />
    </div>
  )
}
