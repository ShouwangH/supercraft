/**
 * Watertight Remesh Fix
 *
 * Fills holes in a mesh to make it watertight.
 * Uses fan triangulation from hole centroid.
 *
 * WARNING: This is a destructive operation that may:
 * - Close intentional vents/openings
 * - Change the mesh topology
 * - Add triangles that alter the visual appearance
 */

import type { MeshData } from '@/types/mesh'
import type { FixResult } from '@/types/fixPlan'
import { buildEdgeMap, getBoundaryEdges, createEdgeKey, type EdgeInfo } from '@/lib/analysis/edgeMap'

export interface WatertightRemeshOptions {
  /** Maximum hole size (in edges) to fill. Larger holes are skipped. Default: 100 */
  maxHoleSize?: number
}

export interface HoleInfo {
  /** Ordered vertex indices forming the hole boundary */
  vertices: number[]
  /** Number of edges in the hole */
  edgeCount: number
}

/**
 * Groups boundary edges into hole loops.
 * Each hole is an ordered list of vertex indices forming a closed loop.
 */
function findHoles(boundaryEdges: EdgeInfo[], positions: Float32Array): HoleInfo[] {
  if (boundaryEdges.length === 0) {
    return []
  }

  // Build adjacency map: vertex -> list of connected vertices via boundary edges
  const adjacency = new Map<number, number[]>()

  for (const edge of boundaryEdges) {
    const [v1, v2] = edge.vertices

    if (!adjacency.has(v1)) adjacency.set(v1, [])
    if (!adjacency.has(v2)) adjacency.set(v2, [])

    adjacency.get(v1)!.push(v2)
    adjacency.get(v2)!.push(v1)
  }

  // Track which edges have been visited
  const visitedEdges = new Set<string>()
  const holes: HoleInfo[] = []

  // For each unvisited boundary edge, trace the hole loop
  for (const edge of boundaryEdges) {
    const edgeKey = createEdgeKey(edge.vertices[0], edge.vertices[1])
    if (visitedEdges.has(edgeKey)) continue

    // Start tracing from this edge
    const loop: number[] = [edge.vertices[0]]
    let current = edge.vertices[1]
    let prev = edge.vertices[0]

    visitedEdges.add(edgeKey)

    // Follow the boundary until we return to the start
    let maxIterations = boundaryEdges.length * 2 // Safety limit
    while (current !== loop[0] && maxIterations > 0) {
      loop.push(current)

      // Find the next vertex (not the one we came from)
      const neighbors = adjacency.get(current) || []
      let next: number | null = null

      for (const neighbor of neighbors) {
        if (neighbor === prev) continue

        const nextEdgeKey = createEdgeKey(current, neighbor)
        if (!visitedEdges.has(nextEdgeKey)) {
          next = neighbor
          visitedEdges.add(nextEdgeKey)
          break
        }
      }

      if (next === null) {
        // Dead end - incomplete loop, skip this hole
        break
      }

      prev = current
      current = next
      maxIterations--
    }

    // Only add complete loops (closed holes)
    if (current === loop[0] && loop.length >= 3) {
      holes.push({
        vertices: loop,
        edgeCount: loop.length,
      })
    }
  }

  return holes
}

/**
 * Computes the centroid of a hole's boundary vertices.
 */
function computeHoleCentroid(
  holeVertices: number[],
  positions: Float32Array
): [number, number, number] {
  let cx = 0, cy = 0, cz = 0

  for (const vi of holeVertices) {
    cx += positions[vi * 3]
    cy += positions[vi * 3 + 1]
    cz += positions[vi * 3 + 2]
  }

  const n = holeVertices.length
  return [cx / n, cy / n, cz / n]
}

/**
 * Computes the normal for a filled hole based on the average of edge directions.
 * Uses the right-hand rule to determine consistent normal direction.
 */
function computeHoleNormal(
  holeVertices: number[],
  centroid: [number, number, number],
  positions: Float32Array
): [number, number, number] {
  // Use Newell's method for computing polygon normal
  let nx = 0, ny = 0, nz = 0

  const n = holeVertices.length
  for (let i = 0; i < n; i++) {
    const curr = holeVertices[i]
    const next = holeVertices[(i + 1) % n]

    const x1 = positions[curr * 3]
    const y1 = positions[curr * 3 + 1]
    const z1 = positions[curr * 3 + 2]

    const x2 = positions[next * 3]
    const y2 = positions[next * 3 + 1]
    const z2 = positions[next * 3 + 2]

    nx += (y1 - y2) * (z1 + z2)
    ny += (z1 - z2) * (x1 + x2)
    nz += (x1 - x2) * (y1 + y2)
  }

  // Normalize
  const length = Math.sqrt(nx * nx + ny * ny + nz * nz)
  if (length > 0) {
    nx /= length
    ny /= length
    nz /= length
  } else {
    // Fallback to up vector
    nx = 0
    ny = 1
    nz = 0
  }

  return [nx, ny, nz]
}

/**
 * Fills holes in a mesh to make it watertight.
 *
 * @param mesh - The mesh to process
 * @param options - Options for hole filling
 * @returns Object with new mesh data and fix result
 */
export function watertightRemesh(
  mesh: MeshData,
  options: WatertightRemeshOptions = {}
): { mesh: MeshData; result: FixResult } {
  const { maxHoleSize = 100 } = options

  // Build edge map and find boundary edges
  const edgeMap = buildEdgeMap(mesh.indices)
  const boundaryEdges = getBoundaryEdges(edgeMap)

  // If no boundary edges, mesh is already watertight
  if (boundaryEdges.length === 0) {
    return {
      mesh,
      result: {
        success: true,
        stats: {
          holesFilled: 0,
          trianglesAdded: 0,
          verticesAdded: 0,
          boundaryEdgesBefore: 0,
          boundaryEdgesAfter: 0,
        },
      },
    }
  }

  // Find holes (loops of boundary edges)
  const holes = findHoles(boundaryEdges, mesh.positions)

  // Filter holes by size
  const holesToFill = holes.filter((h) => h.edgeCount <= maxHoleSize)
  const holesSkipped = holes.length - holesToFill.length

  if (holesToFill.length === 0) {
    return {
      mesh,
      result: {
        success: false,
        error: holesSkipped > 0
          ? `All ${holesSkipped} holes exceed maximum size (${maxHoleSize} edges)`
          : 'No fillable holes found',
        stats: {
          holesFilled: 0,
          holesSkipped,
          trianglesAdded: 0,
          verticesAdded: 0,
          boundaryEdgesBefore: boundaryEdges.length,
          boundaryEdgesAfter: boundaryEdges.length,
        },
      },
    }
  }

  // Calculate new array sizes
  const newVertexCount = holesToFill.length // One centroid per hole
  const newTriangleCount = holesToFill.reduce((sum, h) => sum + h.edgeCount, 0)

  // Create new arrays
  const newPositions = new Float32Array(
    mesh.positions.length + newVertexCount * 3
  )
  const newIndices = new Uint32Array(
    mesh.indices.length + newTriangleCount * 3
  )
  const newNormals = new Float32Array(
    mesh.positions.length + newVertexCount * 3
  )

  // Copy existing data
  newPositions.set(mesh.positions)
  newIndices.set(mesh.indices)
  if (mesh.normals && mesh.normals.length > 0) {
    newNormals.set(mesh.normals)
  }

  // Fill holes
  let currentVertexIndex = mesh.vertexCount
  let currentTriangleIndex = mesh.triangleCount

  for (const hole of holesToFill) {
    // Compute centroid
    const centroid = computeHoleCentroid(hole.vertices, mesh.positions)

    // Compute normal for the fill triangles
    const normal = computeHoleNormal(hole.vertices, centroid, mesh.positions)

    // Add centroid vertex
    const centroidIndex = currentVertexIndex
    newPositions[centroidIndex * 3] = centroid[0]
    newPositions[centroidIndex * 3 + 1] = centroid[1]
    newPositions[centroidIndex * 3 + 2] = centroid[2]

    newNormals[centroidIndex * 3] = normal[0]
    newNormals[centroidIndex * 3 + 1] = normal[1]
    newNormals[centroidIndex * 3 + 2] = normal[2]

    currentVertexIndex++

    // Create fan triangles
    // The winding order matters for correct normals
    // We go in order around the hole, creating triangles: (centroid, v[i], v[i+1])
    const n = hole.vertices.length
    for (let i = 0; i < n; i++) {
      const v1 = hole.vertices[i]
      const v2 = hole.vertices[(i + 1) % n]

      const triIndex = currentTriangleIndex * 3
      newIndices[triIndex] = centroidIndex
      newIndices[triIndex + 1] = v1
      newIndices[triIndex + 2] = v2

      currentTriangleIndex++
    }
  }

  // Compute new bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

  for (let i = 0; i < newPositions.length; i += 3) {
    const x = newPositions[i]
    const y = newPositions[i + 1]
    const z = newPositions[i + 2]
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    minZ = Math.min(minZ, z)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
    maxZ = Math.max(maxZ, z)
  }

  // Verify the result - check remaining boundary edges
  const newEdgeMap = buildEdgeMap(newIndices)
  const remainingBoundaryEdges = getBoundaryEdges(newEdgeMap)

  const newMesh: MeshData = {
    id: `${mesh.id}-watertight`,
    name: `${mesh.name} (watertight)`,
    positions: newPositions,
    indices: newIndices,
    normals: newNormals,
    vertexCount: currentVertexIndex,
    triangleCount: currentTriangleIndex,
    boundingBox: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      dimensions: [maxX - minX, maxY - minY, maxZ - minZ],
    },
  }

  return {
    mesh: newMesh,
    result: {
      success: true,
      newMeshId: newMesh.id,
      stats: {
        holesFilled: holesToFill.length,
        holesSkipped,
        trianglesAdded: newTriangleCount,
        verticesAdded: newVertexCount,
        boundaryEdgesBefore: boundaryEdges.length,
        boundaryEdgesAfter: remainingBoundaryEdges.length,
      },
    },
  }
}
