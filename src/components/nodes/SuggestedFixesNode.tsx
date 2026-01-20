'use client'

import { useCallback, useMemo, useState } from 'react'
import type { NodeProps } from 'reactflow'
import { useReactFlow, useEdges } from 'reactflow'
import type { SuggestedFixesNodeData, MeshSourceNodeData } from '@/types/nodes'
import { BaseNode } from './BaseNode'
import { suggestedFixesDefinition } from '@/lib/nodes/registry'
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
      return 'text-green-400'
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
    LOW: 'bg-emerald-900/50 border-emerald-600',
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
 * Fix recipe card component with destructive warning
 */
function RecipeCard({
  recipe,
  isApplying,
  onApply,
}: {
  recipe: FixRecipe
  isApplying: boolean
  onApply: () => void
}) {
  const [confirmed, setConfirmed] = useState(false)
  const isHighRisk = recipe.risk === 'HIGH'
  const canApply = recipe.implemented && !isApplying && (!isHighRisk || confirmed)

  return (
    <div className={`p-2.5 rounded-lg border space-y-2 transition-colors ${
      isHighRisk
        ? 'bg-red-950/30 border-red-800/50'
        : 'bg-neutral-800/50 border-neutral-700/50'
    }`}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RiskBadge risk={recipe.risk} />
          {recipe.shapeImpact !== 'NONE' && (
            <span className="text-[9px] text-gray-500 uppercase">
              {recipe.shapeImpact} impact
            </span>
          )}
        </div>
        {recipe.implemented ? (
          <button
            onClick={onApply}
            disabled={!canApply}
            className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${
              canApply
                ? isHighRisk
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-purple-600 text-white hover:bg-purple-500'
                : 'bg-neutral-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isApplying ? 'Applying...' : 'Apply Fix'}
          </button>
        ) : (
          <span className="text-[10px] px-2 py-1 bg-neutral-700/50 rounded-md text-gray-400">
            Advisory Only
          </span>
        )}
      </div>

      {/* Title and description */}
      <div>
        <div className="text-xs font-semibold text-gray-200">{recipe.title}</div>
        <div className="text-[11px] text-gray-400 mt-0.5">{recipe.description}</div>
      </div>

      {/* Expected effect */}
      <div className="text-[10px] text-gray-500">
        <span className="text-gray-400">Effect:</span> {recipe.expectedEffect}
      </div>

      {/* Warnings */}
      {recipe.warnings.length > 0 && (
        <div className={`text-[10px] p-2 rounded ${
          isHighRisk ? 'bg-red-950/50' : 'bg-amber-950/30'
        }`}>
          <div className={`font-medium mb-1 ${isHighRisk ? 'text-red-400' : 'text-amber-400'}`}>
            {isHighRisk ? '⚠️ Destructive Operation' : '⚠️ Warnings'}
          </div>
          <ul className={`space-y-0.5 ${isHighRisk ? 'text-red-300/80' : 'text-amber-300/80'}`}>
            {recipe.warnings.map((warning, i) => (
              <li key={i} className="flex gap-1">
                <span>•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* High-risk confirmation checkbox */}
      {isHighRisk && recipe.implemented && (
        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 w-3.5 h-3.5 rounded border-red-600 bg-red-950 text-red-500 focus:ring-red-500 focus:ring-offset-neutral-900"
          />
          <span className="text-[10px] text-red-300">
            I understand this operation is destructive and may significantly alter the mesh
          </span>
        </label>
      )}
    </div>
  )
}

export function SuggestedFixesNode({ id, data, selected }: NodeProps<SuggestedFixesNodeData>) {
  const { getNode } = useReactFlow()
  const edges = useEdges()
  const { getMesh, addMesh, setActiveMesh } = useMeshStore()
  const getReport = useReportStore((state) => state.getReport)
  const { setPlan, getPlan, setGenerating, setApplyingFix, setError } = useFixPlanStore()

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

  // Get the fix plan and report if they exist
  const fixPlan = useMemo(() => {
    if (!connectedMeshId) return null
    return getPlan(connectedMeshId)
  }, [connectedMeshId, getPlan])

  const report = useMemo(() => {
    if (!connectedMeshId) return null
    return getReport(connectedMeshId)
  }, [connectedMeshId, getReport])

  // Determine status
  const status = useMemo(() => {
    if (data.generating) return 'running'
    if (data.error) return 'error'
    if (data.applyingFix) return 'running'
    if (!fixPlan) return 'idle'
    if (fixPlan.recommended.length > 0) return 'warn'
    return 'pass'
  }, [data.generating, data.error, data.applyingFix, fixPlan])

  // Handle generate fix plan
  const handleRun = useCallback(() => {
    if (!connectedMeshId || !report) {
      console.warn('No mesh or report connected')
      return
    }

    setGenerating(connectedMeshId, true)
    setError(connectedMeshId, null)

    try {
      const plan = generateFixPlan(report, connectedMeshId)
      setPlan(connectedMeshId, plan)
    } catch (error) {
      setError(
        connectedMeshId,
        error instanceof Error ? error.message : 'Failed to generate fix plan'
      )
    } finally {
      setGenerating(connectedMeshId, false)
    }
  }, [connectedMeshId, report, setGenerating, setError, setPlan])

  // Handle apply fix
  const handleApplyFix = useCallback(
    async (recipe: FixRecipe) => {
      if (!connectedMeshId) return

      const mesh = getMesh(connectedMeshId)
      if (!mesh) {
        setError(connectedMeshId, 'Mesh not found')
        return
      }

      setApplyingFix(connectedMeshId, recipe.id)
      setError(connectedMeshId, null)

      try {
        const response = await fetch('/api/printability/repair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mesh: {
              positions: Array.from(mesh.positions),
              indices: Array.from(mesh.indices),
              normals: mesh.normals ? Array.from(mesh.normals) : undefined,
            },
            recipeId: recipe.id,
            recipeType: recipe.type,
            params: recipe.steps[0]?.params,
          }),
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Repair failed')
        }

        // Create new mesh from repaired data
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

        const newMeshId = `${connectedMeshId}-${recipe.type}-${Date.now()}`
        addMesh({
          id: newMeshId,
          name: `${mesh.name} (${recipe.title})`,
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
        })

        // Switch to the new mesh
        setActiveMesh(newMeshId)
      } catch (error) {
        setError(
          connectedMeshId,
          error instanceof Error ? error.message : 'Repair failed'
        )
      } finally {
        setApplyingFix(connectedMeshId, null)
      }
    },
    [connectedMeshId, getMesh, setApplyingFix, setError, addMesh, setActiveMesh]
  )

  const applyingRecipeId = useMemo(() => {
    if (!connectedMeshId) return null
    return useFixPlanStore.getState().applyingFix[connectedMeshId]
  }, [connectedMeshId, data.applyingFix])

  return (
    <BaseNode
      label={data.label}
      status={status}
      inputs={suggestedFixesDefinition.inputs}
      outputs={suggestedFixesDefinition.outputs}
      selected={selected}
      onRun={handleRun}
    >
      <div className="space-y-2 max-w-[280px]">
        {/* Status message */}
        {!connectedMeshId && (
          <div className="text-xs text-gray-400">Connect mesh to generate fixes</div>
        )}

        {connectedMeshId && !report && (
          <div className="text-xs text-gray-400">Run analysis first</div>
        )}

        {connectedMeshId && report && !fixPlan && !data.generating && !data.error && (
          <div className="text-xs text-gray-400">Click ▶ to generate fix plan</div>
        )}

        {data.generating && (
          <div className="text-xs text-blue-400 animate-pulse">Generating...</div>
        )}

        {data.error && (
          <div className="text-xs text-red-400">{data.error}</div>
        )}

        {/* Fix plan */}
        {fixPlan && (
          <>
            {/* Recommended fixes */}
            {fixPlan.recommended.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-gray-300">
                  Recommended ({fixPlan.recommended.length})
                </div>
                {fixPlan.recommended.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    isApplying={applyingRecipeId === recipe.id}
                    onApply={() => handleApplyFix(recipe)}
                  />
                ))}
              </div>
            )}

            {/* Advisory fixes */}
            {fixPlan.advisory.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-neutral-700">
                <div className="text-xs font-medium text-gray-400">
                  Advisory ({fixPlan.advisory.length})
                </div>
                {fixPlan.advisory.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    isApplying={applyingRecipeId === recipe.id}
                    onApply={() => handleApplyFix(recipe)}
                  />
                ))}
              </div>
            )}

            {fixPlan.recommended.length === 0 && fixPlan.advisory.length === 0 && (
              <div className="text-xs text-green-400">No fixes needed</div>
            )}
          </>
        )}
      </div>
    </BaseNode>
  )
}
