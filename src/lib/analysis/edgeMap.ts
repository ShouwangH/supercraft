/**
 * Edge Map Module
 *
 * Builds a map of edges to their adjacent faces for mesh topology analysis.
 * Used by watertight and non-manifold detection algorithms.
 */

export interface EdgeInfo {
  /** Vertex indices of the edge (always sorted: min, max) */
  vertices: [number, number]
  /** Indices of faces that share this edge */
  faceIndices: number[]
}

export interface EdgeMap {
  /** Map from edge key "v1-v2" to edge info */
  edges: Map<string, EdgeInfo>
  /** Total number of unique edges */
  edgeCount: number
}

/**
 * Creates a canonical edge key from two vertex indices.
 * Always orders vertices as min-max to ensure undirected edge representation.
 */
export function createEdgeKey(v1: number, v2: number): string {
  return v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`
}

/**
 * Parses an edge key back into vertex indices.
 */
export function parseEdgeKey(key: string): [number, number] {
  const [v1, v2] = key.split('-').map(Number)
  return [v1, v2]
}

/**
 * Builds an edge map from triangle indices.
 *
 * For each triangle, extracts the three edges and records which face
 * each edge belongs to. This allows detection of:
 * - Boundary edges (1 adjacent face) - mesh is not watertight
 * - Manifold edges (2 adjacent faces) - normal closed mesh
 * - Non-manifold edges (3+ adjacent faces) - topology error
 *
 * @param indices - Triangle indices (length must be divisible by 3)
 * @returns EdgeMap with all edges and their face adjacency info
 */
export function buildEdgeMap(indices: Uint32Array): EdgeMap {
  const edges = new Map<string, EdgeInfo>()

  const triangleCount = indices.length / 3

  for (let faceIndex = 0; faceIndex < triangleCount; faceIndex++) {
    const baseIndex = faceIndex * 3
    const v0 = indices[baseIndex]
    const v1 = indices[baseIndex + 1]
    const v2 = indices[baseIndex + 2]

    // Three edges per triangle
    const triangleEdges: [number, number][] = [
      [v0, v1],
      [v1, v2],
      [v2, v0],
    ]

    for (const [a, b] of triangleEdges) {
      const key = createEdgeKey(a, b)

      if (!edges.has(key)) {
        edges.set(key, {
          vertices: a < b ? [a, b] : [b, a],
          faceIndices: [],
        })
      }

      edges.get(key)!.faceIndices.push(faceIndex)
    }
  }

  return {
    edges,
    edgeCount: edges.size,
  }
}

/**
 * Gets all edges with exactly N adjacent faces.
 */
export function getEdgesWithFaceCount(edgeMap: EdgeMap, count: number): EdgeInfo[] {
  const result: EdgeInfo[] = []
  const edges = Array.from(edgeMap.edges.values())
  for (const edge of edges) {
    if (edge.faceIndices.length === count) {
      result.push(edge)
    }
  }
  return result
}

/**
 * Gets all boundary edges (edges with only 1 adjacent face).
 */
export function getBoundaryEdges(edgeMap: EdgeMap): EdgeInfo[] {
  return getEdgesWithFaceCount(edgeMap, 1)
}

/**
 * Gets all non-manifold edges (edges with 3+ adjacent faces).
 */
export function getNonManifoldEdges(edgeMap: EdgeMap): EdgeInfo[] {
  const result: EdgeInfo[] = []
  const edges = Array.from(edgeMap.edges.values())
  for (const edge of edges) {
    if (edge.faceIndices.length > 2) {
      result.push(edge)
    }
  }
  return result
}

/**
 * Gets all manifold edges (edges with exactly 2 adjacent faces).
 */
export function getManifoldEdges(edgeMap: EdgeMap): EdgeInfo[] {
  return getEdgesWithFaceCount(edgeMap, 2)
}
