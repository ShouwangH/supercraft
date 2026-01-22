/**
 * Mesh Cleanup Fix
 *
 * Removes degenerate faces and merges duplicate vertices.
 */

import type { MeshData } from '@/types/mesh'
import type { FixResult } from '@/types/fixPlan'
import { computeNormals, computeBoundingBox } from '@/types/mesh'

export interface MeshCleanupOptions {
  /** Area threshold for degenerate face removal */
  areaThreshold?: number
  /** Epsilon for vertex merging */
  mergeEpsilon?: number
  /** Whether to recompute normals */
  recomputeNormals?: boolean
}

/**
 * Computes the area of a triangle given its vertex positions.
 */
function triangleArea(
  x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number
): number {
  // Edge vectors
  const ax = x1 - x0, ay = y1 - y0, az = z1 - z0
  const bx = x2 - x0, by = y2 - y0, bz = z2 - z0

  // Cross product
  const cx = ay * bz - az * by
  const cy = az * bx - ax * bz
  const cz = ax * by - ay * bx

  // Area = 0.5 * |cross product|
  return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz)
}

/**
 * Creates a spatial hash key for a vertex position.
 */
function vertexKey(x: number, y: number, z: number, epsilon: number): string {
  const scale = 1 / epsilon
  const ix = Math.round(x * scale)
  const iy = Math.round(y * scale)
  const iz = Math.round(z * scale)
  return `${ix},${iy},${iz}`
}

/**
 * Cleans up a mesh by removing degenerate faces and merging duplicate vertices.
 *
 * @param mesh - The mesh to process
 * @param options - Cleanup options
 * @returns Object with new mesh data and fix result
 */
export function meshCleanup(
  mesh: MeshData,
  options: MeshCleanupOptions = {}
): { mesh: MeshData; result: FixResult } {
  const {
    areaThreshold = 1e-10,
    mergeEpsilon = 1e-6,
    recomputeNormals = true,
  } = options

  // Step 1: Merge duplicate vertices
  const vertexMap = new Map<string, number>() // hash -> new vertex index
  const newVertexPositions: number[] = []
  const oldToNewVertex = new Map<number, number>() // old index -> new index

  for (let i = 0; i < mesh.vertexCount; i++) {
    const x = mesh.positions[i * 3]
    const y = mesh.positions[i * 3 + 1]
    const z = mesh.positions[i * 3 + 2]

    const key = vertexKey(x, y, z, mergeEpsilon)

    if (vertexMap.has(key)) {
      // Map to existing vertex
      oldToNewVertex.set(i, vertexMap.get(key)!)
    } else {
      // Create new vertex
      const newIdx = newVertexPositions.length / 3
      vertexMap.set(key, newIdx)
      oldToNewVertex.set(i, newIdx)
      newVertexPositions.push(x, y, z)
    }
  }

  const verticesMerged = mesh.vertexCount - newVertexPositions.length / 3

  // Step 2: Remap indices and filter degenerate faces
  const faceCount = mesh.triangleCount
  const keptFaceIndices: number[] = []
  let degenerateFacesRemoved = 0

  for (let f = 0; f < faceCount; f++) {
    const i0 = oldToNewVertex.get(mesh.indices[f * 3])!
    const i1 = oldToNewVertex.get(mesh.indices[f * 3 + 1])!
    const i2 = oldToNewVertex.get(mesh.indices[f * 3 + 2])!

    // Skip degenerate faces (duplicate indices)
    if (i0 === i1 || i1 === i2 || i2 === i0) {
      degenerateFacesRemoved++
      continue
    }

    // Compute face area
    const x0 = newVertexPositions[i0 * 3]
    const y0 = newVertexPositions[i0 * 3 + 1]
    const z0 = newVertexPositions[i0 * 3 + 2]
    const x1 = newVertexPositions[i1 * 3]
    const y1 = newVertexPositions[i1 * 3 + 1]
    const z1 = newVertexPositions[i1 * 3 + 2]
    const x2 = newVertexPositions[i2 * 3]
    const y2 = newVertexPositions[i2 * 3 + 1]
    const z2 = newVertexPositions[i2 * 3 + 2]

    const area = triangleArea(x0, y0, z0, x1, y1, z1, x2, y2, z2)

    if (area < areaThreshold) {
      degenerateFacesRemoved++
      continue
    }

    keptFaceIndices.push(i0, i1, i2)
  }

  // Step 3: Remove unused vertices
  const usedVertices = new Set<number>()
  for (const idx of keptFaceIndices) {
    usedVertices.add(idx)
  }

  const sortedUsedVertices = Array.from(usedVertices).sort((a, b) => a - b)
  const finalVertexRemap = new Map<number, number>()
  sortedUsedVertices.forEach((oldIdx, newIdx) => {
    finalVertexRemap.set(oldIdx, newIdx)
  })

  // Build final positions
  const finalPositions = new Float32Array(sortedUsedVertices.length * 3)
  for (let i = 0; i < sortedUsedVertices.length; i++) {
    const oldIdx = sortedUsedVertices[i]
    finalPositions[i * 3] = newVertexPositions[oldIdx * 3]
    finalPositions[i * 3 + 1] = newVertexPositions[oldIdx * 3 + 1]
    finalPositions[i * 3 + 2] = newVertexPositions[oldIdx * 3 + 2]
  }

  // Build final indices
  const finalIndices = new Uint32Array(keptFaceIndices.length)
  for (let i = 0; i < keptFaceIndices.length; i++) {
    finalIndices[i] = finalVertexRemap.get(keptFaceIndices[i])!
  }

  // Compute normals
  const finalNormals = recomputeNormals
    ? computeNormals(finalPositions, finalIndices)
    : new Float32Array(finalPositions.length)

  // Compute bounding box
  const boundingBox = computeBoundingBox(finalPositions)

  const newMesh: MeshData = {
    id: `${mesh.id}-cleaned`,
    name: `${mesh.name} (cleaned)`,
    positions: finalPositions,
    indices: finalIndices,
    normals: finalNormals,
    vertexCount: sortedUsedVertices.length,
    triangleCount: keptFaceIndices.length / 3,
    boundingBox,
  }

  const totalVerticesRemoved = mesh.vertexCount - newMesh.vertexCount

  return {
    mesh: newMesh,
    result: {
      success: true,
      newMeshId: newMesh.id,
      stats: {
        trianglesRemoved: degenerateFacesRemoved,
        verticesRemoved: totalVerticesRemoved,
      },
    },
  }
}
