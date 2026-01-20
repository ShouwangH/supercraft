'use client'

import { useCallback, useMemo } from 'react'
import type { NodeProps } from 'reactflow'
import { useReactFlow, useEdges } from 'reactflow'
import type { PrintabilityReportNodeData, MeshSourceNodeData } from '@/types/nodes'
import { BaseNode } from './BaseNode'
import { printabilityReportDefinition } from '@/lib/nodes/registry'
import { useMeshStore } from '@/stores/meshStore'
import { useReportStore } from '@/stores/reportStore'
import { useViewerStore, type OverlayMode } from '@/stores/viewerStore'
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
 * Maps issue type to overlay mode
 */
function getOverlayModeForIssue(issueType: string): OverlayMode | null {
  switch (issueType) {
    case 'boundary_edges':
      return 'boundary_edges'
    case 'non_manifold_edges':
      return 'non_manifold_edges'
    case 'floater_components':
      return 'components'
    case 'overhang':
      return 'overhang'
    default:
      return null
  }
}

/**
 * Issue card component
 */
function IssueCard({
  issue,
  isHighlighted,
  onToggleHighlight,
}: {
  issue: Issue
  isHighlighted: boolean
  onToggleHighlight: () => void
}) {
  const overlayMode = getOverlayModeForIssue(issue.type)
  const hasOverlay = overlayMode !== null

  return (
    <div className="p-2 bg-neutral-800 rounded border border-neutral-700 space-y-1">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${getSeverityColor(issue.severity)}`}>
          {issue.severity}
        </span>
        {hasOverlay && (
          <button
            onClick={onToggleHighlight}
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              isHighlighted
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-700 text-gray-300 hover:bg-neutral-600'
            }`}
          >
            {isHighlighted ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      <div className="text-xs font-medium text-gray-200">{issue.title}</div>
      <div className="text-[10px] text-gray-400">{issue.summary}</div>
    </div>
  )
}

export function PrintabilityReportNode({ id, data, selected }: NodeProps<PrintabilityReportNodeData>) {
  const { getNode } = useReactFlow()
  const edges = useEdges()
  const getMesh = useMeshStore((state) => state.getMesh)
  const { setReport, setAnalyzing, setError, getReport } = useReportStore()
  const { overlayMode, setOverlayMode, clearOverlay } = useViewerStore()

  // Find connected mesh source node
  const connectedMeshId = useMemo(() => {
    // Find edge where this node is the target and the handle is 'mesh'
    const incomingEdge = edges.find(
      (e) => e.target === id && e.targetHandle === 'mesh'
    )
    if (!incomingEdge) return null

    // Get the source node
    const sourceNode = getNode(incomingEdge.source)
    if (!sourceNode || sourceNode.type !== 'mesh-source') return null

    // Get the mesh ID from the source node's data
    const sourceData = sourceNode.data as MeshSourceNodeData
    return sourceData.meshId
  }, [edges, id, getNode])

  // Get the report if it exists
  const report = useMemo(() => {
    if (!connectedMeshId) return null
    return getReport(connectedMeshId)
  }, [connectedMeshId, getReport])

  // Determine status based on report
  const status = useMemo(() => {
    if (data.analyzing) return 'running'
    if (data.error) return 'error'
    if (!report) return 'idle'
    switch (report.status) {
      case 'PASS':
        return 'pass'
      case 'WARN':
        return 'warn'
      case 'FAIL':
        return 'fail'
      default:
        return 'idle'
    }
  }, [data.analyzing, data.error, report])

  // Handle run analysis
  const handleRun = useCallback(async () => {
    if (!connectedMeshId) {
      console.warn('No mesh connected')
      return
    }

    const mesh = getMesh(connectedMeshId)
    if (!mesh) {
      setError(connectedMeshId, 'Mesh not found')
      return
    }

    setAnalyzing(connectedMeshId, true)
    setError(connectedMeshId, null)
    clearOverlay()

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
      setAnalyzing(connectedMeshId, false)
    }
  }, [connectedMeshId, getMesh, setAnalyzing, setError, setReport, clearOverlay])

  // Handle toggle highlight for an issue
  const handleToggleHighlight = useCallback(
    (issueType: string) => {
      const mode = getOverlayModeForIssue(issueType)
      if (!mode) return

      if (overlayMode === mode) {
        clearOverlay()
      } else {
        setOverlayMode(mode)
      }
    },
    [overlayMode, setOverlayMode, clearOverlay]
  )

  return (
    <BaseNode
      label={data.label}
      status={status}
      inputs={printabilityReportDefinition.inputs}
      outputs={printabilityReportDefinition.outputs}
      selected={selected}
      onRun={handleRun}
    >
      <div className="space-y-2 max-w-[200px]">
        {/* Status message */}
        {!connectedMeshId && (
          <div className="text-xs text-gray-400">Connect mesh to analyze</div>
        )}

        {connectedMeshId && !report && !data.analyzing && !data.error && (
          <div className="text-xs text-gray-400">Click ▶ to run analysis</div>
        )}

        {data.analyzing && (
          <div className="text-xs text-blue-400 animate-pulse">Analyzing...</div>
        )}

        {data.error && (
          <div className="text-xs text-red-400">{data.error}</div>
        )}

        {/* Report summary */}
        {report && (
          <>
            <div className="text-xs space-y-1 border-b border-neutral-700 pb-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Triangles:</span>
                <span className="text-gray-200">{report.meshStats.triangleCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Components:</span>
                <span className="text-gray-200">{report.meshStats.componentCount}</span>
              </div>
            </div>

            {/* Issues list */}
            {report.issues.length > 0 ? (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-gray-300">
                  Issues ({report.issues.length})
                </div>
                {report.issues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    isHighlighted={overlayMode === getOverlayModeForIssue(issue.type)}
                    onToggleHighlight={() => handleToggleHighlight(issue.type)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-xs text-green-400">No issues found</div>
            )}
          </>
        )}
      </div>
    </BaseNode>
  )
}
