/**
 * Fix Plan Generator
 *
 * Generates fix recommendations based on printability report issues.
 */

import type { PrintabilityReport, Issue } from '@/types/report'
import type { FixPlan, FixRecipe } from '@/types/fixPlan'
import { FIX_PLAN_SCHEMA_VERSION } from '@/types/fixPlan'

/**
 * Generates a fix recipe for floater removal
 */
function createFloaterRemovalRecipe(issue: Issue): FixRecipe {
  const floaterCount = (issue.details?.floaterCount as number) ?? 0
  const floaterFaceCount = (issue.details?.floaterFaceCount as number) ?? 0

  return {
    id: `fix-floaters-${Date.now()}`,
    type: 'remove_floaters',
    title: 'Remove Floating Fragments',
    description: `Remove ${floaterCount} small disconnected component${floaterCount !== 1 ? 's' : ''} (${floaterFaceCount} face${floaterFaceCount !== 1 ? 's' : ''} total).`,
    targetIssues: [issue.id],
    risk: 'LOW',
    shapeImpact: 'LOCAL',
    deterministic: true,
    implemented: true,
    steps: [
      {
        op: 'remove_components_below_threshold',
        params: { thresholdPercent: 5 },
      },
    ],
    warnings: [
      'Removes small disconnected parts. Verify no intentional details were removed.',
    ],
    expectedEffect: 'Removes floating geometry that may cause print failures.',
  }
}

/**
 * Generates a fix recipe for mesh cleanup
 */
function createMeshCleanupRecipe(issues: Issue[]): FixRecipe {
  const targetIssues = issues.map((i) => i.id)

  return {
    id: `fix-cleanup-${Date.now()}`,
    type: 'mesh_cleanup',
    title: 'Mesh Cleanup',
    description: 'Remove degenerate faces and merge duplicate vertices.',
    targetIssues,
    risk: 'LOW',
    shapeImpact: 'NONE',
    deterministic: true,
    implemented: true,
    steps: [
      { op: 'remove_degenerate_faces', params: { areaThreshold: 1e-10 } },
      { op: 'merge_duplicate_vertices', params: { epsilon: 1e-6 } },
      { op: 'recompute_normals' },
    ],
    warnings: [
      'Cleanup should not change silhouette, but verify critical edges.',
    ],
    expectedEffect: 'Improves mesh quality without changing geometry.',
  }
}

/**
 * Generates a fix recipe for auto-orientation suggestion
 */
function createAutoOrientRecipe(issue: Issue): FixRecipe {
  const overhangPercentage = (issue.details?.overhangPercentage as number) ?? 0

  return {
    id: `fix-orient-${Date.now()}`,
    type: 'auto_orient',
    title: 'Optimize Orientation',
    description: `Current orientation has ${overhangPercentage.toFixed(1)}% overhang. Find optimal orientation to minimize supports.`,
    targetIssues: [issue.id],
    risk: 'LOW',
    shapeImpact: 'NONE',
    deterministic: true,
    implemented: true,
    steps: [
      {
        op: 'find_optimal_orientation',
        params: { rotations: [0, 90, 180, 270] },
      },
    ],
    warnings: [
      'Orientation reduces supports but does not guarantee print success.',
      'You may need to manually adjust orientation based on your specific needs.',
    ],
    expectedEffect: 'Suggests rotation to reduce overhang and support requirements.',
  }
}

/**
 * Generates a fix recipe for watertight remesh
 */
function createWatertightRemeshRecipe(issues: Issue[]): FixRecipe {
  const targetIssues = issues.map((i) => i.id)
  const boundaryEdgeCount = issues.find((i) => i.type === 'boundary_edges')?.details?.boundaryEdgeCount as number ?? 0

  return {
    id: `fix-remesh-${Date.now()}`,
    type: 'watertight_remesh',
    title: 'Fill Holes (Watertight)',
    description: `Fill holes to close ${boundaryEdgeCount} boundary edge${boundaryEdgeCount !== 1 ? 's' : ''}.`,
    targetIssues,
    risk: 'HIGH',
    shapeImpact: 'GLOBAL',
    deterministic: true,
    implemented: true,
    steps: [
      { op: 'fill_holes', params: { maxHoleSize: 100 } },
    ],
    warnings: [
      'DESTRUCTIVE: May close intentional vents or openings.',
      'Adds triangles to fill holes - verify appearance after.',
      'Use for prototypes only. Validate fits after operation.',
    ],
    expectedEffect: 'Creates watertight mesh by filling holes with fan triangulation.',
  }
}

/**
 * Sorts recipes by priority (lower risk first, then by impact)
 */
function sortRecipesByPriority(recipes: FixRecipe[]): FixRecipe[] {
  const riskOrder = { LOW: 0, MEDIUM: 1, HIGH: 2 }
  const impactOrder = { NONE: 0, LOCAL: 1, GLOBAL: 2 }

  return [...recipes].sort((a, b) => {
    // First by risk
    const riskDiff = riskOrder[a.risk] - riskOrder[b.risk]
    if (riskDiff !== 0) return riskDiff

    // Then by shape impact
    return impactOrder[a.shapeImpact] - impactOrder[b.shapeImpact]
  })
}

/**
 * Generates a fix plan based on a printability report.
 *
 * @param report - The printability report to generate fixes for
 * @param meshId - The mesh ID
 * @returns FixPlan with recommended and advisory fixes
 */
export function generateFixPlan(
  report: PrintabilityReport,
  meshId: string
): FixPlan {
  const recommended: FixRecipe[] = []
  const advisory: FixRecipe[] = []

  // Check for floater components
  const floaterIssue = report.issues.find((i) => i.type === 'floater_components')
  if (floaterIssue) {
    recommended.push(createFloaterRemovalRecipe(floaterIssue))
  }

  // Check for overhang issues
  const overhangIssue = report.issues.find((i) => i.type === 'overhang')
  if (overhangIssue) {
    recommended.push(createAutoOrientRecipe(overhangIssue))
  }

  // Always offer mesh cleanup as a low-risk option
  if (report.issues.length > 0) {
    recommended.push(createMeshCleanupRecipe(report.issues))
  }

  // Check for watertight issues (boundary edges only - non-manifold needs different handling)
  const boundaryIssues = report.issues.filter((i) => i.type === 'boundary_edges')
  if (boundaryIssues.length > 0) {
    // Watertight remesh is now implemented - add to recommended
    recommended.push(createWatertightRemeshRecipe(boundaryIssues))
  }

  return {
    schemaVersion: FIX_PLAN_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    meshId,
    reportId: meshId, // Using meshId as reportId since reports are keyed by meshId
    recommended: sortRecipesByPriority(recommended),
    advisory: sortRecipesByPriority(advisory),
  }
}
