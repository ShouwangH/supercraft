/**
 * Mesh Decimation Module
 *
 * Simple decimation for analysis purposes only.
 * Uses uniform sampling to reduce triangle count while preserving mesh structure.
 */

import type { MeshData } from '@/types/mesh'

export interface DecimationResult {
  /** Decimated mesh for analysis */
  mesh: MeshData
  /** Whether decimation was performed */
  wasDecimated: boolean
  /** Original triangle count before decimation */
  originalTriangleCount: number
}

/**
 * Decimates a mesh for analysis if it exceeds the maximum triangle count.
 * Uses uniform sampling of triangles to reduce mesh complexity.
 *
 * Note: This is for analysis only - the decimated mesh maintains
 * topological properties but may have reduced accuracy.
 *
 * @param mesh - The original mesh
 * @param maxTriangles - Maximum number of triangles allowed
 * @returns DecimationResult with potentially decimated mesh
 */
export function decimateForAnalysis(
  mesh: MeshData,
  maxTriangles: number
): DecimationResult {
  const originalTriangleCount = mesh.triangleCount

  // No decimation needed
  if (originalTriangleCount <= maxTriangles) {
    return {
      mesh,
      wasDecimated: false,
      originalTriangleCount,
    }
  }

  // Calculate sampling ratio
  const ratio = maxTriangles / originalTriangleCount

  // Create array of face indices and shuffle for uniform sampling
  const faceIndices: number[] = []
  for (let i = 0; i < originalTriangleCount; i++) {
    faceIndices.push(i)
  }

  // Fisher-Yates shuffle with deterministic seed for reproducibility
  // Using triangle count as seed for consistency
  let seed = originalTriangleCount
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  for (let i = faceIndices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[faceIndices[i], faceIndices[j]] = [faceIndices[j], faceIndices[i]]
  }

  // Select faces to keep
  const facesToKeep = faceIndices.slice(0, maxTriangles)
  facesToKeep.sort((a, b) => a - b) // Sort for better cache locality

  // Build vertex remapping
  const usedVertices = new Set<number>()
  for (const faceIdx of facesToKeep) {
    usedVertices.add(mesh.indices[faceIdx * 3])
    usedVertices.add(mesh.indices[faceIdx * 3 + 1])
    usedVertices.add(mesh.indices[faceIdx * 3 + 2])
  }

  const sortedUsedVertices = Array.from(usedVertices).sort((a, b) => a - b)
  const vertexRemap = new Map<number, number>()
  sortedUsedVertices.forEach((oldIdx, newIdx) => {
    vertexRemap.set(oldIdx, newIdx)
  })

  // Build new positions array
  const newPositions = new Float32Array(sortedUsedVertices.length * 3)
  for (let i = 0; i < sortedUsedVertices.length; i++) {
    const oldIdx = sortedUsedVertices[i]
    newPositions[i * 3] = mesh.positions[oldIdx * 3]
    newPositions[i * 3 + 1] = mesh.positions[oldIdx * 3 + 1]
    newPositions[i * 3 + 2] = mesh.positions[oldIdx * 3 + 2]
  }

  // Build new indices array
  const newIndices = new Uint32Array(facesToKeep.length * 3)
  for (let i = 0; i < facesToKeep.length; i++) {
    const faceIdx = facesToKeep[i]
    newIndices[i * 3] = vertexRemap.get(mesh.indices[faceIdx * 3])!
    newIndices[i * 3 + 1] = vertexRemap.get(mesh.indices[faceIdx * 3 + 1])!
    newIndices[i * 3 + 2] = vertexRemap.get(mesh.indices[faceIdx * 3 + 2])!
  }

  // Build new normals array if original had normals
  let newNormals: Float32Array | undefined
  if (mesh.normals && mesh.normals.length > 0) {
    newNormals = new Float32Array(sortedUsedVertices.length * 3)
    for (let i = 0; i < sortedUsedVertices.length; i++) {
      const oldIdx = sortedUsedVertices[i]
      newNormals[i * 3] = mesh.normals[oldIdx * 3]
      newNormals[i * 3 + 1] = mesh.normals[oldIdx * 3 + 1]
      newNormals[i * 3 + 2] = mesh.normals[oldIdx * 3 + 2]
    }
  }

  const decimatedMesh: MeshData = {
    id: `${mesh.id}-decimated`,
    name: `${mesh.name} (decimated)`,
    positions: newPositions,
    indices: newIndices,
    normals: newNormals ?? new Float32Array(newPositions.length),
    vertexCount: sortedUsedVertices.length,
    triangleCount: facesToKeep.length,
    // Keep original bounding box since we're sampling uniformly
    boundingBox: mesh.boundingBox,
  }

  return {
    mesh: decimatedMesh,
    wasDecimated: true,
    originalTriangleCount,
  }
}
