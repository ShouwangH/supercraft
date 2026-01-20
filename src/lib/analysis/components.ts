/**
 * Connected Components Module
 *
 * Finds connected components (separate mesh pieces) using union-find algorithm.
 * Used to detect "floater" geometry that should be removed before printing.
 */

import type { EdgeMap } from './edgeMap'
import { buildEdgeMap } from './edgeMap'

export interface ComponentsResult {
  /** Total number of connected components */
  componentCount: number
  /** Component ID for each face (0-indexed, contiguous) */
  componentIdPerFace: Uint32Array
  /** Number of faces in each component (indexed by component ID) */
  componentSizes: number[]
  /** Index of the main (largest) component */
  mainComponentIndex: number
  /** Indices of floater components (below threshold) */
  floaterIndices: number[]
  /** Total face count of all floaters */
  floaterFaceCount: number
}

/**
 * Union-Find data structure for efficient component tracking
 */
class UnionFind {
  private parent: number[]
  private rank: number[]

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i)
    this.rank = Array(size).fill(0)
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]) // Path compression
    }
    return this.parent[x]
  }

  union(x: number, y: number): void {
    const rootX = this.find(x)
    const rootY = this.find(y)

    if (rootX === rootY) return

    // Union by rank
    if (this.rank[rootX] < this.rank[rootY]) {
      this.parent[rootX] = rootY
    } else if (this.rank[rootX] > this.rank[rootY]) {
      this.parent[rootY] = rootX
    } else {
      this.parent[rootY] = rootX
      this.rank[rootX]++
    }
  }
}

/**
 * Finds connected components in a mesh.
 *
 * Two faces are connected if they share an edge. Uses union-find algorithm
 * for efficient component detection.
 *
 * @param indices - Triangle indices
 * @param edgeMap - Pre-computed edge map from buildEdgeMap()
 * @param floaterThreshold - Faces below this percentage of total are considered floaters (0-100)
 * @returns ComponentsResult with component information
 */
export function findConnectedComponents(
  indices: Uint32Array,
  edgeMap: EdgeMap,
  floaterThreshold: number = 5
): ComponentsResult {
  const faceCount = indices.length / 3

  if (faceCount === 0) {
    return {
      componentCount: 0,
      componentIdPerFace: new Uint32Array(0),
      componentSizes: [],
      mainComponentIndex: -1,
      floaterIndices: [],
      floaterFaceCount: 0,
    }
  }

  // Use union-find to group faces by shared edges
  const uf = new UnionFind(faceCount)

  // For each edge, union all faces that share it
  const edgeValues = Array.from(edgeMap.edges.values())
  for (const edge of edgeValues) {
    const faces = edge.faceIndices
    if (faces.length >= 2) {
      // Connect all faces sharing this edge
      for (let i = 1; i < faces.length; i++) {
        uf.union(faces[0], faces[i])
      }
    }
  }

  // Collect component roots and assign contiguous IDs
  const rootToComponentId = new Map<number, number>()
  const componentIdPerFace = new Uint32Array(faceCount)
  let nextComponentId = 0

  for (let face = 0; face < faceCount; face++) {
    const root = uf.find(face)
    if (!rootToComponentId.has(root)) {
      rootToComponentId.set(root, nextComponentId++)
    }
    componentIdPerFace[face] = rootToComponentId.get(root)!
  }

  const componentCount = nextComponentId

  // Count faces per component
  const componentSizes = Array(componentCount).fill(0)
  for (let face = 0; face < faceCount; face++) {
    componentSizes[componentIdPerFace[face]]++
  }

  // Find main component (largest)
  let mainComponentIndex = 0
  let maxSize = componentSizes[0] || 0
  for (let i = 1; i < componentCount; i++) {
    if (componentSizes[i] > maxSize) {
      maxSize = componentSizes[i]
      mainComponentIndex = i
    }
  }

  // Find floater components (below threshold percentage of total faces)
  const thresholdFaceCount = Math.ceil((floaterThreshold / 100) * faceCount)
  const floaterIndices: number[] = []
  let floaterFaceCount = 0

  for (let i = 0; i < componentCount; i++) {
    if (i !== mainComponentIndex && componentSizes[i] < thresholdFaceCount) {
      floaterIndices.push(i)
      floaterFaceCount += componentSizes[i]
    }
  }

  return {
    componentCount,
    componentIdPerFace,
    componentSizes,
    mainComponentIndex,
    floaterIndices,
    floaterFaceCount,
  }
}

/**
 * Convenience function that builds edge map and finds components in one call.
 *
 * @param indices - Triangle indices
 * @param floaterThreshold - Faces below this percentage of total are considered floaters
 * @returns ComponentsResult with component information
 */
export function findConnectedComponentsFromIndices(
  indices: Uint32Array,
  floaterThreshold: number = 5
): ComponentsResult {
  const edgeMap = buildEdgeMap(indices)
  return findConnectedComponents(indices, edgeMap, floaterThreshold)
}

/**
 * Gets the face indices belonging to a specific component.
 *
 * @param componentIdPerFace - Component ID for each face
 * @param componentId - The component to get faces for
 * @returns Array of face indices in the component
 */
export function getFacesInComponent(
  componentIdPerFace: Uint32Array,
  componentId: number
): number[] {
  const faces: number[] = []
  for (let i = 0; i < componentIdPerFace.length; i++) {
    if (componentIdPerFace[i] === componentId) {
      faces.push(i)
    }
  }
  return faces
}
