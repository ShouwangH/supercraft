/**
 * CSG Union Fix
 *
 * Uses boolean union to merge overlapping/intersecting components into a single watertight mesh.
 * This is particularly useful for non-manifold meshes where components share edges improperly.
 */

import * as THREE from 'three'
import { Brush, Evaluator, ADDITION } from 'three-bvh-csg'
import type { MeshData } from '@/types/mesh'
import type { FixResult } from '@/types/fixPlan'
import { findConnectedComponentsFromIndices, getFacesInComponent } from '@/lib/analysis/components'
import { computeBoundingBox, computeNormals } from '@/types/mesh'

export interface CsgUnionOptions {
  /** Whether to log debug information */
  debug?: boolean
}

/**
 * Extracts a component from the mesh as a separate geometry
 */
function extractComponent(
  mesh: MeshData,
  componentIdPerFace: Uint32Array,
  componentId: number
): THREE.BufferGeometry {
  const faceIndices = getFacesInComponent(componentIdPerFace, componentId)

  // Collect unique vertices used by this component
  const usedVertices = new Set<number>()
  for (const faceIdx of faceIndices) {
    usedVertices.add(mesh.indices[faceIdx * 3])
    usedVertices.add(mesh.indices[faceIdx * 3 + 1])
    usedVertices.add(mesh.indices[faceIdx * 3 + 2])
  }

  // Create vertex remapping
  const sortedVertices = Array.from(usedVertices).sort((a, b) => a - b)
  const vertexRemap = new Map<number, number>()
  sortedVertices.forEach((oldIdx, newIdx) => {
    vertexRemap.set(oldIdx, newIdx)
  })

  // Build new positions array
  const positions = new Float32Array(sortedVertices.length * 3)
  for (let i = 0; i < sortedVertices.length; i++) {
    const oldIdx = sortedVertices[i]
    positions[i * 3] = mesh.positions[oldIdx * 3]
    positions[i * 3 + 1] = mesh.positions[oldIdx * 3 + 1]
    positions[i * 3 + 2] = mesh.positions[oldIdx * 3 + 2]
  }

  // Build new indices array
  const indices = new Uint32Array(faceIndices.length * 3)
  for (let i = 0; i < faceIndices.length; i++) {
    const faceIdx = faceIndices[i]
    indices[i * 3] = vertexRemap.get(mesh.indices[faceIdx * 3])!
    indices[i * 3 + 1] = vertexRemap.get(mesh.indices[faceIdx * 3 + 1])!
    indices[i * 3 + 2] = vertexRemap.get(mesh.indices[faceIdx * 3 + 2])!
  }

  // Create Three.js geometry
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.computeVertexNormals()

  return geometry
}

/**
 * Converts a Three.js BufferGeometry back to MeshData format
 */
function geometryToMeshData(geometry: THREE.BufferGeometry, baseMesh: MeshData): MeshData {
  const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute
  const indexAttr = geometry.getIndex()

  if (!indexAttr) {
    throw new Error('Geometry must be indexed')
  }

  const positions = new Float32Array(positionAttr.array)
  const indices = new Uint32Array(indexAttr.array)
  const normals = computeNormals(positions, indices)
  const boundingBox = computeBoundingBox(positions)

  return {
    id: `${baseMesh.id}-csg-union`,
    name: `${baseMesh.name} (merged)`,
    positions,
    indices,
    normals,
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
    boundingBox,
  }
}

/**
 * Performs CSG union on all components of a mesh.
 *
 * @param mesh - The mesh to process
 * @param options - Options for the operation
 * @returns Object with merged mesh data and fix result
 */
export function csgUnion(
  mesh: MeshData,
  options: CsgUnionOptions = {}
): { mesh: MeshData; result: FixResult } {
  // Always log for debugging
  console.log('[CSG] Starting CSG union...')
  console.log('[CSG] Input mesh:', { triangles: mesh.triangleCount, vertices: mesh.vertexCount })

  // Find connected components
  const components = findConnectedComponentsFromIndices(mesh.indices)

  console.log('[CSG] Component count:', components.componentCount)
  console.log('[CSG] Component sizes:', components.componentSizes)

  // If only one component, nothing to union
  if (components.componentCount <= 1) {
    console.log('[CSG] Only one component, nothing to union')
    return {
      mesh,
      result: {
        success: true,
        stats: {
          componentsUnioned: 0,
        },
      },
    }
  }

  try {
    // Extract each component as a separate geometry
    const geometries: THREE.BufferGeometry[] = []
    for (let i = 0; i < components.componentCount; i++) {
      const geometry = extractComponent(mesh, components.componentIdPerFace, i)
      const posAttr = geometry.getAttribute('position')
      console.log(`[CSG] Component ${i}: ${posAttr.count} vertices, ${geometry.getIndex()?.count ?? 0 / 3} indices`)
      geometries.push(geometry)
    }

    console.log('[CSG] Extracted', geometries.length, 'components')

    // Create brushes from geometries
    console.log('[CSG] Creating brushes...')
    const brushes = geometries.map((geom, idx) => {
      const brush = new Brush(geom)
      brush.updateMatrixWorld()
      console.log(`[CSG] Brush ${idx} created`)
      return brush
    })

    // Sequentially union all brushes
    console.log('[CSG] Starting union operations...')
    const evaluator = new Evaluator()
    let result = brushes[0]

    for (let i = 1; i < brushes.length; i++) {
      console.log(`[CSG] Unioning brush ${i}...`)
      result = evaluator.evaluate(result, brushes[i], ADDITION)
      const resultPos = result.geometry.getAttribute('position')
      console.log(`[CSG] After union ${i}: ${resultPos.count} vertices`)
    }

    // Get the resulting geometry
    const resultGeometry = result.geometry
    console.log('[CSG] Final geometry:', {
      vertices: resultGeometry.getAttribute('position').count,
      indices: resultGeometry.getIndex()?.count ?? 0,
    })

    // Convert back to MeshData
    const mergedMesh = geometryToMeshData(resultGeometry, mesh)
    console.log('[CSG] Merged mesh:', { triangles: mergedMesh.triangleCount, vertices: mergedMesh.vertexCount })

    // Cleanup
    geometries.forEach((g) => g.dispose())
    brushes.forEach((b) => b.geometry.dispose())

    return {
      mesh: mergedMesh,
      result: {
        success: true,
        newMeshId: mergedMesh.id,
        stats: {
          componentsUnioned: components.componentCount,
          trianglesBefore: mesh.triangleCount,
          trianglesAfter: mergedMesh.triangleCount,
        },
      },
    }
  } catch (error) {
    console.error('[CSG] Union failed:', error)
    return {
      mesh,
      result: {
        success: false,
        stats: {},
      },
    }
  }
}
