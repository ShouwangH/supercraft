'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NodeProps } from 'reactflow'
import { useReactFlow, useEdges } from 'reactflow'
import { Handle, Position } from 'reactflow'
import type { SuggestedFixesNodeData, AppNode, AppEdge } from '@/types/nodes'
import { NODE_TYPES } from '@/types/nodes'
import { useMeshStore } from '@/stores/meshStore'
import { useReportStore } from '@/stores/reportStore'
import { useFixPlanStore } from '@/stores/fixPlanStore'
import { generateFixPlan } from '@/lib/repair/fixPlanGenerator'
import type { FixRecipe, FixRisk } from '@/types/fixPlan'

/**
 * Maps risk level to CSS color class
 */
function getRiskColor(risk: FixRisk): string {
  switch (risk) {
    case 'LOW':
      return 'text-blue-400'
    case 'MEDIUM':
      return 'text-yellow-400'
    case 'HIGH':
      return 'text-red-400'
    default:
      return 'text-gray-400'
  }
}

/**
 * Risk badge component
 */
function RiskBadge({ risk }: { risk: FixRisk }) {
  const bgColor = {
    LOW: 'bg-blue-900/50 border-blue-600',
    MEDIUM: 'bg-amber-900/50 border-amber-600',
    HIGH: 'bg-red-900/50 border-red-600',
  }[risk]

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${bgColor} ${getRiskColor(risk)}`}>
      {risk}
    </span>
  )
}

/**
 * Checklist item for a fix
 */
function FixChecklistItem({
  recipe,
  checked,
  onChange,
  disabled,
}: {
  recipe: FixRecipe
  checked: boolean
  onChange: (checked: boolean) => void
  disabled: boolean
}) {
  const isHighRisk = recipe.risk === 'HIGH'

  return (
    <div className={`p-2 rounded border ${
      isHighRisk ? 'bg-red-950/20 border-red-800/30' : 'bg-neutral-700/30 border-neutral-600/30'
    }`}>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled || !recipe.implemented}
          className="mt-0.5 w-3.5 h-3.5 rounded border-neutral-500 bg-neutral-700 text-blue-500 focus:ring-blue-500"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <RiskBadge risk={recipe.risk} />
            <span className="text-xs text-gray-200 font-medium">{recipe.title}</span>
            {!recipe.implemented && (
              <span className="text-[9px] text-gray-500">(Advisory)</span>
            )}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">{recipe.description}</div>
          {isHighRisk && recipe.warnings.length > 0 && (
            <div className="text-[10px] text-red-300/80 mt-1">
              ⚠️ {recipe.warnings[0]}
            </div>
          )}
        </div>
      </label>
    </div>
  )
}

export function SuggestedFixesNode({ id, data, selected }: NodeProps<SuggestedFixesNodeData>) {
  const { getNode, getNodes, addNodes, addEdges, setNodes, setEdges } = useReactFlow()
  const edges = useEdges()
  const { getMesh, addMesh } = useMeshStore()
  // Subscribe to the reports object directly so we re-render when reports change
  const reports = useReportStore((state) => state.reports)
  const { setPlan, setGenerating, setApplyingFix, setError } = useFixPlanStore()
  // Subscribe to plans directly for reactivity
  const plans = useFixPlanStore((state) => state.plans)
  const hasAutoRun = useRef(false)
  const [isGenerating, setIsGeneratingLocal] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [selectedFixes, setSelectedFixes] = useState<Set<string>>(new Set())

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

  // Get the fix plan and report if they exist (using direct subscriptions for reactivity)
  const fixPlan = useMemo(() => {
    if (!connectedMeshId) return null
    return plans[connectedMeshId] || null
  }, [connectedMeshId, plans])

  const report = useMemo(() => {
    if (!connectedMeshId) return null
    return reports[connectedMeshId] || null
  }, [connectedMeshId, reports])

  // All fixes combined
  const allFixes = useMemo(() => {
    if (!fixPlan) return []
    return [...fixPlan.recommended, ...fixPlan.advisory]
  }, [fixPlan])

  // Implemented fixes that can be selected
  const implementedFixes = useMemo(() => {
    return allFixes.filter((f) => f.implemented)
  }, [allFixes])

  // Generate fix plan
  const runGeneration = useCallback(() => {
    if (!connectedMeshId || !report) return

    setIsGeneratingLocal(true)
    setGenerating(connectedMeshId, true)
    setError(connectedMeshId, null)

    try {
      const plan = generateFixPlan(report, connectedMeshId)
      setPlan(connectedMeshId, plan)
      // Auto-select recommended fixes
      const recommended = plan.recommended.filter((r) => r.implemented).map((r) => r.id)
      setSelectedFixes(new Set(recommended))
    } catch (error) {
      setError(
        connectedMeshId,
        error instanceof Error ? error.message : 'Failed to generate fix plan'
      )
    } finally {
      setIsGeneratingLocal(false)
      setGenerating(connectedMeshId, false)
    }
  }, [connectedMeshId, report, setGenerating, setError, setPlan])

  // Auto-run when connected and report exists
  useEffect(() => {
    if (connectedMeshId && report && !fixPlan && !hasAutoRun.current && !isGenerating) {
      hasAutoRun.current = true
      runGeneration()
    }
  }, [connectedMeshId, report, fixPlan, isGenerating, runGeneration])

  // Toggle fix selection
  const toggleFix = useCallback((fixId: string, checked: boolean) => {
    setSelectedFixes((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(fixId)
      } else {
        next.delete(fixId)
      }
      return next
    })
  }, [])

  // Apply selected fixes
  const handleApplyFixes = useCallback(async () => {
    if (!connectedMeshId || selectedFixes.size === 0) return

    const mesh = getMesh(connectedMeshId)
    if (!mesh) {
      setError(connectedMeshId, 'Mesh not found')
      return
    }

    setIsApplying(true)
    setError(connectedMeshId, null)

    // Get the selected recipes in order
    const selectedRecipes = allFixes.filter((f) => selectedFixes.has(f.id))

    try {
      // Apply fixes sequentially
      let currentMesh = mesh
      let currentMeshId = connectedMeshId

      for (const recipe of selectedRecipes) {
        setApplyingFix(connectedMeshId, recipe.id)

        const requestBody = {
          mesh: {
            positions: Array.from(currentMesh.positions),
            indices: Array.from(currentMesh.indices),
            normals: currentMesh.normals ? Array.from(currentMesh.normals) : undefined,
          },
          recipeId: recipe.id,
          recipeType: recipe.type,
          params: recipe.steps[0]?.params,
        }
        console.log('[FIX] Sending repair request:', { recipeType: recipe.type, params: requestBody.params })

        const response = await fetch('/api/printability/repair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })

        const result = await response.json()
        console.log('[FIX] Repair response:', result)

        if (!response.ok || !result.success) {
          throw new Error(result.error || `Failed to apply ${recipe.title}`)
        }

        // Update current mesh for next iteration
        const repairedPositions = new Float32Array(result.mesh.positions)
        const repairedIndices = new Uint32Array(result.mesh.indices)
        const repairedNormals = result.mesh.normals
          ? new Float32Array(result.mesh.normals)
          : new Float32Array(repairedPositions.length)

        // Compute bounding box
        let minX = Infinity, minY = Infinity, minZ = Infinity
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

        for (let i = 0; i < repairedPositions.length; i += 3) {
          const x = repairedPositions[i]
          const y = repairedPositions[i + 1]
          const z = repairedPositions[i + 2]
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          minZ = Math.min(minZ, z)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
          maxZ = Math.max(maxZ, z)
        }

        currentMesh = {
          id: `${currentMeshId}-${recipe.type}-${Date.now()}`,
          name: `${mesh.name} (Fixed)`,
          positions: repairedPositions,
          indices: repairedIndices,
          normals: repairedNormals,
          vertexCount: repairedPositions.length / 3,
          triangleCount: repairedIndices.length / 3,
          boundingBox: {
            min: [minX, minY, minZ],
            max: [maxX, maxY, maxZ],
            dimensions: [maxX - minX, maxY - minY, maxZ - minZ],
          },
        }
        currentMeshId = currentMesh.id
      }

      // Add the final repaired mesh to the store
      addMesh(currentMesh)

      // Create a new ModelViewerNode to display the corrected mesh
      const thisNode = getNode(id) as AppNode
      if (thisNode) {
        const position = findNonOverlappingPosition(thisNode.position.x + 350, thisNode.position.y)
        const newNodeId = `model-viewer-fixed-${Date.now()}`
        const newNode: AppNode = {
          id: newNodeId,
          type: NODE_TYPES.MODEL_VIEWER,
          position,
          data: {
            label: 'Corrected Model',
            status: 'pass',
            meshId: currentMesh.id,
            meshName: currentMesh.name,
            error: null,
          },
        }

        const newEdge: AppEdge = {
          id: `edge-${id}-${newNodeId}`,
          source: id,
          sourceHandle: 'repaired_mesh',
          target: newNodeId,
          targetHandle: 'mesh',
        }

        addNodes([newNode])
        addEdges([newEdge])
      }

      // Clear selections after successful apply
      setSelectedFixes(new Set())
    } catch (error) {
      setError(
        connectedMeshId,
        error instanceof Error ? error.message : 'Repair failed'
      )
    } finally {
      setIsApplying(false)
      setApplyingFix(connectedMeshId, null)
    }
  }, [connectedMeshId, selectedFixes, allFixes, getMesh, getNode, id, addMesh, addNodes, addEdges, setApplyingFix, setError, findNonOverlappingPosition])

  // Determine border color based on status
  const getBorderColor = () => {
    if (selected) return 'border-blue-500 shadow-lg shadow-blue-500/20'
    if (isGenerating || isApplying) return 'border-blue-500'
    if (data.error) return 'border-red-500'
    if (fixPlan && fixPlan.recommended.length > 0) return 'border-yellow-500'
    if (fixPlan) return 'border-blue-500'
    return 'border-neutral-600'
  }

  return (
    <div
      className={`bg-neutral-800 rounded-lg border-2 min-w-[220px] max-w-[300px] transition-all ${getBorderColor()}`}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="report"
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
        {isGenerating && (
          <div className="space-y-2">
            <div className="text-xs text-blue-400 animate-pulse">Generating fixes...</div>
            <div className="w-full h-1 bg-neutral-700 rounded overflow-hidden">
              <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* Applying state */}
        {isApplying && (
          <div className="space-y-2">
            <div className="text-xs text-blue-400 animate-pulse">Applying fixes...</div>
            <div className="w-full h-1 bg-neutral-700 rounded overflow-hidden">
              <div className="h-full bg-blue-500 animate-pulse" style={{ width: '80%' }} />
            </div>
          </div>
        )}

        {/* Error state */}
        {data.error && (
          <div className="text-xs text-red-400">{data.error}</div>
        )}

        {/* No connection */}
        {!connectedMeshId && !isGenerating && (
          <div className="text-xs text-gray-400">Connect to report to generate fixes</div>
        )}

        {/* Waiting for report */}
        {connectedMeshId && !report && !isGenerating && (
          <div className="text-xs text-gray-400">Waiting for analysis...</div>
        )}

        {/* Fix checklist */}
        {fixPlan && !isGenerating && !isApplying && (
          <>
            {allFixes.length > 0 ? (
              <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                {allFixes.map((recipe) => (
                  <FixChecklistItem
                    key={recipe.id}
                    recipe={recipe}
                    checked={selectedFixes.has(recipe.id)}
                    onChange={(checked) => toggleFix(recipe.id, checked)}
                    disabled={isApplying}
                  />
                ))}
              </div>
            ) : (
              <div className="text-xs text-blue-400">No fixes needed</div>
            )}
          </>
        )}
      </div>

      {/* Apply Fixes button */}
      {fixPlan && implementedFixes.length > 0 && !isGenerating && !isApplying && (
        <div className="px-3 pb-3">
          <button
            onClick={handleApplyFixes}
            disabled={selectedFixes.size === 0}
            className="w-full px-3 py-1.5 text-xs font-medium bg-white text-neutral-900 hover:bg-blue-500 hover:text-white disabled:bg-neutral-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded transition-colors"
          >
            Apply {selectedFixes.size > 0 ? `${selectedFixes.size} Fix${selectedFixes.size > 1 ? 'es' : ''}` : 'Fixes'}
          </button>
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="repaired_mesh"
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-neutral-800"
      />
    </div>
  )
}
