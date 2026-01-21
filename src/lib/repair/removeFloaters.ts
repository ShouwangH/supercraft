/**
 * Remove Floaters Fix
 *
 * Removes small disconnected components (floaters) from a mesh.
 */

import type { MeshData } from '@/types/mesh'
import type { FixResult } from '@/types/fixPlan'
import { findConnectedComponentsFromIndices, getFacesInComponent } from '@/lib/analysis/components'

export interface RemoveFloatersOptions {
  /** Threshold percentage - components below this % of total faces are removed */
  thresholdPercent?: number
}

/**
 * Removes floater components from a mesh.
 *
 * @param mesh - The mesh to process
 * @param options - Options for floater removal
 * @returns Object with new mesh data and fix result
 */
export function removeFloaters(
  mesh: MeshData,
  options: RemoveFloatersOptions = {}
): { mesh: MeshData; result: FixResult } {
  const { thresholdPercent = 5 } = options

  // Find connected components
  const components = findConnectedComponentsFromIndices(mesh.indices, thresholdPercent)

  // If no floaters, return original mesh
  if (components.floaterIndices.length === 0) {
    return {
      mesh,
      result: {
        success: true,
        stats: {
          trianglesRemoved: 0,
          verticesRemoved: 0,
          componentsRemoved: 0,
        },
      },
    }
  }

  // Create set of floater component IDs for fast lookup
  const floaterSet = new Set(components.floaterIndices)

  // Collect faces to keep (those not in floater components)
  const facesToKeep: number[] = []
  const faceCount = mesh.indices.length / 3

  for (let f = 0; f < faceCount; f++) {
    const componentId = components.componentIdPerFace[f]
    if (!floaterSet.has(componentId)) {
      facesToKeep.push(f)
    }
  }

  // Build vertex remapping (old index -> new index)
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

  const trianglesRemoved = faceCount - facesToKeep.length
  const verticesRemoved = mesh.vertexCount - sortedUsedVertices.length

  const newMesh: MeshData = {
    id: `${mesh.id}-floaters-removed`,
    name: `${mesh.name} (floaters removed)`,
    positions: newPositions,
    indices: newIndices,
    normals: newNormals ?? new Float32Array(newPositions.length),
    vertexCount: sortedUsedVertices.length,
    triangleCount: facesToKeep.length,
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
        trianglesRemoved,
        verticesRemoved,
        componentsRemoved: components.floaterIndices.length,
      },
    },
  }
}
