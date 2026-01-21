import { describe, it, expect } from 'vitest'
import { meshCleanup } from '@/lib/repair/meshCleanup'
import type { MeshData } from '@/types/mesh'

describe('meshCleanup', () => {
  // Create a mesh with duplicate vertices
  const createMeshWithDuplicates = (): MeshData => {
    // Two triangles sharing an edge but with duplicated vertices at shared edge
    const positions = new Float32Array([
      // First triangle
      0, 0, 0,    // v0
      1, 0, 0,    // v1
      0.5, 1, 0,  // v2
      // Second triangle with duplicated edge vertices
      1, 0, 0,    // v3 (duplicate of v1)
      2, 0, 0,    // v4
      1.5, 1, 0,  // v5
    ])

    const indices = new Uint32Array([
      0, 1, 2, // First triangle
      3, 4, 5, // Second triangle
    ])

    return {
      id: 'test-mesh',
      name: 'Test Mesh',
      positions,
      indices,
      normals: new Float32Array(positions.length),
      vertexCount: 6,
      triangleCount: 2,
      boundingBox: {
        min: [0, 0, 0],
        max: [2, 1, 0],
        dimensions: [2, 1, 0],
      },
    }
  }

  // Create a mesh with a degenerate face (zero area)
  const createMeshWithDegenerateFace = (): MeshData => {
    const positions = new Float32Array([
      // Valid triangle
      0, 0, 0,
      1, 0, 0,
      0.5, 1, 0,
      // Degenerate triangle (all on a line)
      5, 0, 0,
      6, 0, 0,
      5.5, 0, 0,
    ])

    const indices = new Uint32Array([
      0, 1, 2, // Valid triangle
      3, 4, 5, // Degenerate triangle
    ])

    return {
      id: 'degenerate-mesh',
      name: 'Degenerate Mesh',
      positions,
      indices,
      normals: new Float32Array(positions.length),
      vertexCount: 6,
      triangleCount: 2,
      boundingBox: {
        min: [0, 0, 0],
        max: [6, 1, 0],
        dimensions: [6, 1, 0],
      },
    }
  }

  // Create a clean mesh with no issues
  const createCleanMesh = (): MeshData => {
    const positions = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0.5, 1, 0,
    ])

    const indices = new Uint32Array([0, 1, 2])

    return {
      id: 'clean-mesh',
      name: 'Clean Mesh',
      positions,
      indices,
      normals: new Float32Array(positions.length),
      vertexCount: 3,
      triangleCount: 1,
      boundingBox: {
        min: [0, 0, 0],
        max: [1, 1, 0],
        dimensions: [1, 1, 0],
      },
    }
  }

  it('should merge duplicate vertices', () => {
    const mesh = createMeshWithDuplicates()
    const result = meshCleanup(mesh)

    expect(result.result.success).toBe(true)
    // v1 and v3 are duplicates, so we should have 5 unique vertices
    expect(result.mesh.vertexCount).toBe(5)
    expect(result.result.stats.verticesRemoved).toBe(1)
  })

  it('should remove degenerate faces', () => {
    const mesh = createMeshWithDegenerateFace()
    const result = meshCleanup(mesh)

    expect(result.result.success).toBe(true)
    expect(result.mesh.triangleCount).toBe(1)
    expect(result.result.stats.trianglesRemoved).toBe(1)
  })

  it('should not change clean mesh geometry', () => {
    const mesh = createCleanMesh()
    const result = meshCleanup(mesh)

    expect(result.result.success).toBe(true)
    expect(result.mesh.vertexCount).toBe(3)
    expect(result.mesh.triangleCount).toBe(1)
    expect(result.result.stats.trianglesRemoved).toBe(0)
    expect(result.result.stats.verticesRemoved).toBe(0)
  })

  it('should generate new mesh ID', () => {
    const mesh = createMeshWithDuplicates()
    const result = meshCleanup(mesh)

    expect(result.mesh.id).toContain(mesh.id)
    expect(result.mesh.id).toContain('cleaned')
    expect(result.result.newMeshId).toBe(result.mesh.id)
  })

  it('should update mesh name', () => {
    const mesh = createMeshWithDuplicates()
    const result = meshCleanup(mesh)

    expect(result.mesh.name).toContain(mesh.name)
    expect(result.mesh.name).toContain('cleaned')
  })

  it('should recompute normals by default', () => {
    const mesh = createCleanMesh()
    mesh.normals = new Float32Array(9).fill(0) // Zero normals

    const result = meshCleanup(mesh)

    // Normals should be computed (not all zeros)
    const hasNonZeroNormal = Array.from(result.mesh.normals).some((v) => v !== 0)
    expect(hasNonZeroNormal).toBe(true)
  })

  it('should skip normal recomputation when disabled', () => {
    const mesh = createCleanMesh()
    mesh.normals = new Float32Array(9).fill(0) // Zero normals

    const result = meshCleanup(mesh, { recomputeNormals: false })

    // Normals should remain as zeros (all zeros)
    const allZeros = Array.from(result.mesh.normals).every((v) => v === 0)
    expect(allZeros).toBe(true)
  })

  it('should respect area threshold option', () => {
    const mesh = createMeshWithDegenerateFace()

    // Very small threshold - should still remove degenerate
    const result1 = meshCleanup(mesh, { areaThreshold: 1e-15 })
    expect(result1.mesh.triangleCount).toBe(1)

    // Huge threshold - should remove both triangles
    const result2 = meshCleanup(mesh, { areaThreshold: 1000 })
    expect(result2.mesh.triangleCount).toBe(0)
  })

  it('should respect merge epsilon option', () => {
    const mesh = createMeshWithDuplicates()

    // Tiny epsilon - no merging (but cleanup still happens)
    const result1 = meshCleanup(mesh, { mergeEpsilon: 1e-15 })
    // With tiny epsilon, duplicate vertices at exact same position ARE still merged
    // because the spatial hash rounds to the same cell
    expect(result1.mesh.vertexCount).toBe(5) // Vertices at same position merged

    // Normal epsilon - merges duplicates
    const result2 = meshCleanup(mesh, { mergeEpsilon: 1e-6 })
    expect(result2.mesh.vertexCount).toBe(5) // One vertex merged
  })

  it('should remove faces with duplicate indices after merge', () => {
    // Create mesh where vertex merging creates duplicate indices in a face
    const positions = new Float32Array([
      0, 0, 0,
      0, 0, 0, // Duplicate of v0
      1, 0, 0,
    ])

    const indices = new Uint32Array([0, 1, 2]) // After merge: 0, 0, 1 (degenerate)

    const mesh: MeshData = {
      id: 'dupe-idx-mesh',
      name: 'Dupe Index Mesh',
      positions,
      indices,
      normals: new Float32Array(positions.length),
      vertexCount: 3,
      triangleCount: 1,
      boundingBox: {
        min: [0, 0, 0],
        max: [1, 0, 0],
        dimensions: [1, 0, 0],
      },
    }

    const result = meshCleanup(mesh)

    // Face should be removed due to duplicate indices after merge
    expect(result.mesh.triangleCount).toBe(0)
  })

  it('should compute correct bounding box', () => {
    const mesh = createMeshWithDuplicates()
    const result = meshCleanup(mesh)

    expect(result.mesh.boundingBox.min[0]).toBeCloseTo(0)
    expect(result.mesh.boundingBox.min[1]).toBeCloseTo(0)
    expect(result.mesh.boundingBox.max[0]).toBeCloseTo(2)
    expect(result.mesh.boundingBox.max[1]).toBeCloseTo(1)
  })
})
