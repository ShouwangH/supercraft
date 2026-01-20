import { describe, it, expect } from 'vitest'
import { decimateForAnalysis } from '@/lib/analysis/decimation'
import type { MeshData } from '@/types/mesh'

// Helper to create a mesh with specified number of triangles
function createTestMesh(triangleCount: number): MeshData {
  const vertexCount = triangleCount * 3 // Simple case: 3 unique vertices per triangle
  const positions = new Float32Array(vertexCount * 3)
  const indices = new Uint32Array(triangleCount * 3)
  const normals = new Float32Array(vertexCount * 3)

  // Generate simple triangles
  for (let i = 0; i < triangleCount; i++) {
    const baseVertex = i * 3
    const baseIdx = i * 3

    // Create a simple triangle at position i
    positions[baseVertex * 3] = i
    positions[baseVertex * 3 + 1] = 0
    positions[baseVertex * 3 + 2] = 0

    positions[(baseVertex + 1) * 3] = i + 1
    positions[(baseVertex + 1) * 3 + 1] = 0
    positions[(baseVertex + 1) * 3 + 2] = 0

    positions[(baseVertex + 2) * 3] = i + 0.5
    positions[(baseVertex + 2) * 3 + 1] = 1
    positions[(baseVertex + 2) * 3 + 2] = 0

    indices[baseIdx] = baseVertex
    indices[baseIdx + 1] = baseVertex + 1
    indices[baseIdx + 2] = baseVertex + 2

    // Simple normals
    normals[(baseVertex) * 3 + 2] = 1
    normals[(baseVertex + 1) * 3 + 2] = 1
    normals[(baseVertex + 2) * 3 + 2] = 1
  }

  return {
    id: 'test-mesh',
    name: 'Test Mesh',
    positions,
    indices,
    normals,
    vertexCount,
    triangleCount,
    boundingBox: {
      min: [0, 0, 0],
      max: [triangleCount, 1, 0],
      dimensions: [triangleCount, 1, 0],
    },
  }
}

// Helper to create a closed cube mesh (shared vertices)
function createClosedCubeMesh(): MeshData {
  const positions = new Float32Array([
    // Bottom face (y = 0)
    0, 0, 0, 10, 0, 0, 10, 0, 10, 0, 0, 10,
    // Top face (y = 10)
    0, 10, 0, 10, 10, 0, 10, 10, 10, 0, 10, 10,
  ])
  const indices = new Uint32Array([
    0, 2, 1, 0, 3, 2, // Bottom
    4, 5, 6, 4, 6, 7, // Top
    3, 6, 2, 3, 7, 6, // Front
    0, 1, 5, 0, 5, 4, // Back
    0, 4, 7, 0, 7, 3, // Left
    1, 2, 6, 1, 6, 5, // Right
  ])

  return {
    id: 'test-cube',
    name: 'Test Cube',
    positions,
    indices,
    normals: new Float32Array(positions.length),
    vertexCount: 8,
    triangleCount: 12,
    boundingBox: {
      min: [0, 0, 0],
      max: [10, 10, 10],
      dimensions: [10, 10, 10],
    },
  }
}

describe('decimation', () => {
  describe('decimateForAnalysis', () => {
    it('should not decimate mesh under threshold', () => {
      const mesh = createTestMesh(100)
      const result = decimateForAnalysis(mesh, 200)

      expect(result.wasDecimated).toBe(false)
      expect(result.mesh).toBe(mesh) // Same reference
      expect(result.originalTriangleCount).toBe(100)
    })

    it('should not decimate mesh at exactly threshold', () => {
      const mesh = createTestMesh(100)
      const result = decimateForAnalysis(mesh, 100)

      expect(result.wasDecimated).toBe(false)
      expect(result.mesh).toBe(mesh)
    })

    it('should decimate mesh over threshold', () => {
      const mesh = createTestMesh(200)
      const result = decimateForAnalysis(mesh, 100)

      expect(result.wasDecimated).toBe(true)
      expect(result.mesh).not.toBe(mesh) // Different reference
      expect(result.mesh.triangleCount).toBe(100)
      expect(result.originalTriangleCount).toBe(200)
    })

    it('should preserve bounding box after decimation', () => {
      const mesh = createTestMesh(200)
      const result = decimateForAnalysis(mesh, 100)

      expect(result.mesh.boundingBox).toEqual(mesh.boundingBox)
    })

    it('should update mesh id and name for decimated mesh', () => {
      const mesh = createTestMesh(200)
      const result = decimateForAnalysis(mesh, 100)

      expect(result.mesh.id).toBe('test-mesh-decimated')
      expect(result.mesh.name).toBe('Test Mesh (decimated)')
    })

    it('should produce valid indices after decimation', () => {
      const mesh = createTestMesh(200)
      const result = decimateForAnalysis(mesh, 100)

      const decimatedMesh = result.mesh
      const maxVertexIndex = decimatedMesh.vertexCount - 1

      // Check all indices are valid
      for (let i = 0; i < decimatedMesh.indices.length; i++) {
        expect(decimatedMesh.indices[i]).toBeGreaterThanOrEqual(0)
        expect(decimatedMesh.indices[i]).toBeLessThanOrEqual(maxVertexIndex)
      }
    })

    it('should have correct vertex count after decimation', () => {
      const mesh = createClosedCubeMesh() // 12 triangles, 8 vertices (shared)
      const result = decimateForAnalysis(mesh, 6) // Keep 6 triangles

      expect(result.wasDecimated).toBe(true)
      expect(result.mesh.triangleCount).toBe(6)
      // Vertex count should be less than or equal to original
      expect(result.mesh.vertexCount).toBeLessThanOrEqual(8)
    })

    it('should produce deterministic results', () => {
      const mesh = createTestMesh(200)

      const result1 = decimateForAnalysis(mesh, 100)
      const result2 = decimateForAnalysis(mesh, 100)

      // Same faces should be selected each time
      expect(result1.mesh.triangleCount).toBe(result2.mesh.triangleCount)

      // Verify indices are identical
      for (let i = 0; i < result1.mesh.indices.length; i++) {
        expect(result1.mesh.indices[i]).toBe(result2.mesh.indices[i])
      }
    })

    it('should preserve normals when present', () => {
      const mesh = createTestMesh(200)
      const result = decimateForAnalysis(mesh, 100)

      expect(result.mesh.normals).toBeDefined()
      expect(result.mesh.normals.length).toBe(result.mesh.vertexCount * 3)
    })

    it('should handle mesh with no normals', () => {
      const mesh = createTestMesh(200)
      // Remove normals
      const meshWithoutNormals: MeshData = {
        ...mesh,
        normals: new Float32Array(0),
      }

      const result = decimateForAnalysis(meshWithoutNormals, 100)

      expect(result.wasDecimated).toBe(true)
      // Should create empty normals array matching vertex count
      expect(result.mesh.normals.length).toBe(result.mesh.vertexCount * 3)
    })

    it('should correctly reduce large mesh', () => {
      const largeMesh = createTestMesh(10000)
      const result = decimateForAnalysis(largeMesh, 1000)

      expect(result.wasDecimated).toBe(true)
      expect(result.mesh.triangleCount).toBe(1000)
      expect(result.originalTriangleCount).toBe(10000)
    })
  })
})
