/**
 * Non-Manifold Detection Module
 *
 * Detects non-manifold edges in a mesh. A non-manifold edge is shared by
 * more than 2 faces, which creates topology errors that can cause problems
 * in 3D printing.
 */

import type { EdgeMap } from './edgeMap'
import { buildEdgeMap, getNonManifoldEdges } from './edgeMap'

export interface NonManifoldResult {
  /** Whether the mesh has any non-manifold edges */
  hasNonManifold: boolean
  /** Flat array of non-manifold edge vertex pairs [a,b, a,b, ...] for overlay rendering */
  nonManifoldEdges: number[]
  /** Number of non-manifold edges found */
  nonManifoldEdgeCount: number
  /** Map of edge key to face count for edges with 3+ faces */
  edgeFaceCounts: Map<string, number>
}

/**
 * Checks for non-manifold edges in a mesh.
 *
 * A manifold mesh has edges shared by exactly 2 faces (or 1 for boundary edges).
 * Non-manifold edges (3+ adjacent faces) indicate topology errors like:
 * - T-junctions where faces meet incorrectly
 * - Boolean operation artifacts
 * - Overlapping geometry
 *
 * @param edgeMap - Pre-computed edge map from buildEdgeMap()
 * @returns NonManifoldResult with non-manifold edge information
 */
export function checkNonManifold(edgeMap: EdgeMap): NonManifoldResult {
  const nonManifoldEdgeInfos = getNonManifoldEdges(edgeMap)

  // Flatten non-manifold edges for overlay rendering
  const nonManifoldEdges: number[] = []
  const edgeFaceCounts = new Map<string, number>()

  for (const edge of nonManifoldEdgeInfos) {
    nonManifoldEdges.push(edge.vertices[0], edge.vertices[1])
    const key = `${edge.vertices[0]}-${edge.vertices[1]}`
    edgeFaceCounts.set(key, edge.faceIndices.length)
  }

  return {
    hasNonManifold: nonManifoldEdgeInfos.length > 0,
    nonManifoldEdges,
    nonManifoldEdgeCount: nonManifoldEdgeInfos.length,
    edgeFaceCounts,
  }
}

/**
 * Convenience function that builds edge map and checks non-manifold in one call.
 *
 * @param indices - Triangle indices
 * @returns NonManifoldResult with non-manifold edge information
 */
export function checkNonManifoldFromIndices(indices: Uint32Array): NonManifoldResult {
  const edgeMap = buildEdgeMap(indices)
  return checkNonManifold(edgeMap)
}
