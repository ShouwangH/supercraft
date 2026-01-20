/**
 * Watertight Analysis Module
 *
 * Checks if a mesh is watertight (closed) by detecting boundary edges.
 * A watertight mesh has no boundary edges - every edge is shared by exactly 2 faces.
 */

import type { EdgeMap } from './edgeMap'
import { buildEdgeMap, getBoundaryEdges } from './edgeMap'

export interface WatertightResult {
  /** Whether the mesh is watertight (no boundary edges) */
  isWatertight: boolean
  /** Flat array of boundary edge vertex pairs [a,b, a,b, ...] for overlay rendering */
  boundaryEdges: number[]
  /** Number of boundary edges found */
  boundaryEdgeCount: number
}

/**
 * Checks if a mesh is watertight by analyzing its edge topology.
 *
 * A mesh is watertight if every edge is shared by exactly 2 faces.
 * Boundary edges (edges shared by only 1 face) indicate holes or open surfaces.
 *
 * @param edgeMap - Pre-computed edge map from buildEdgeMap()
 * @returns WatertightResult with boundary edge information
 */
export function checkWatertight(edgeMap: EdgeMap): WatertightResult {
  const boundaryEdgeInfos = getBoundaryEdges(edgeMap)

  // Flatten boundary edges for overlay rendering
  const boundaryEdges: number[] = []
  for (const edge of boundaryEdgeInfos) {
    boundaryEdges.push(edge.vertices[0], edge.vertices[1])
  }

  return {
    isWatertight: boundaryEdgeInfos.length === 0,
    boundaryEdges,
    boundaryEdgeCount: boundaryEdgeInfos.length,
  }
}

/**
 * Convenience function that builds edge map and checks watertight in one call.
 *
 * @param indices - Triangle indices
 * @returns WatertightResult with boundary edge information
 */
export function checkWatertightFromIndices(indices: Uint32Array): WatertightResult {
  const edgeMap = buildEdgeMap(indices)
  return checkWatertight(edgeMap)
}
