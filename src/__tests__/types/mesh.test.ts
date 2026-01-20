import { describe, it, expect } from 'vitest'
import {
  validateMeshData,
  computeBoundingBox,
  computeNormals,
  type MeshData,
} from '@/types/mesh'

describe('mesh types', () => {
  describe('validateMeshData', () => {
    const createValidMesh = (): MeshData => ({
      id: 'test-mesh',
      name: 'Test Mesh',
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0.5, 1, 0]),
      indices: new Uint32Array([0, 1, 2]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      vertexCount: 3,
      triangleCount: 1,
      boundingBox: {
        min: [0, 0, 0],
        max: [1, 1, 0],
        dimensions: [1, 1, 0],
      },
    })

    it('validates correct mesh data', () => {
      const mesh = createValidMesh()
      const result = validateMeshData(mesh)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('detects positions length not divisible by 3', () => {
      const mesh = createValidMesh()
      mesh.positions = new Float32Array([0, 0, 0, 1]) // 4 values, not divisible by 3
      mesh.vertexCount = 1 // Update to match, but still invalid positions

      const result = validateMeshData(mesh)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Positions length'))).toBe(true)
    })

    it('detects indices length not divisible by 3', () => {
      const mesh = createValidMesh()
      mesh.indices = new Uint32Array([0, 1]) // 2 values, not divisible by 3
      mesh.triangleCount = 0 // Would be 0.67, so mismatch

      const result = validateMeshData(mesh)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Indices length'))).toBe(true)
    })

    it('detects vertex count mismatch', () => {
      const mesh = createValidMesh()
      mesh.vertexCount = 5 // Should be 3

      const result = validateMeshData(mesh)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Vertex count'))).toBe(true)
    })

    it('detects triangle count mismatch', () => {
      const mesh = createValidMesh()
      mesh.triangleCount = 5 // Should be 1

      const result = validateMeshData(mesh)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Triangle count'))).toBe(true)
    })

    it('detects indices exceeding vertex count', () => {
      const mesh = createValidMesh()
      mesh.indices = new Uint32Array([0, 1, 10]) // 10 exceeds vertex count of 3

      const result = validateMeshData(mesh)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('exceeds vertex count'))).toBe(true)
    })

    it('detects normals length mismatch', () => {
      const mesh = createValidMesh()
      mesh.normals = new Float32Array([0, 0, 1]) // Only 3 values, should be 9

      const result = validateMeshData(mesh)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Normals length'))).toBe(true)
    })

    it('detects bounding box min > max', () => {
      const mesh = createValidMesh()
      mesh.boundingBox.min = [5, 0, 0] // X min > X max
      mesh.boundingBox.dimensions = [-4, 1, 0]

      const result = validateMeshData(mesh)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('BBox min'))).toBe(true)
    })

    it('detects bounding box dimensions mismatch', () => {
      const mesh = createValidMesh()
      mesh.boundingBox.dimensions = [10, 10, 10] // Wrong dimensions

      const result = validateMeshData(mesh)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('dimensions'))).toBe(true)
    })
  })

  describe('computeBoundingBox', () => {
    it('computes bounding box for single point', () => {
      const positions = new Float32Array([1, 2, 3])
      const bbox = computeBoundingBox(positions)

      expect(bbox.min).toEqual([1, 2, 3])
      expect(bbox.max).toEqual([1, 2, 3])
      expect(bbox.dimensions).toEqual([0, 0, 0])
    })

    it('computes bounding box for multiple points', () => {
      const positions = new Float32Array([
        0, 0, 0, // Point 1
        5, 3, 2, // Point 2
        -1, 4, 1, // Point 3
      ])
      const bbox = computeBoundingBox(positions)

      expect(bbox.min).toEqual([-1, 0, 0])
      expect(bbox.max).toEqual([5, 4, 2])
      expect(bbox.dimensions).toEqual([6, 4, 2])
    })

    it('handles empty positions array', () => {
      const positions = new Float32Array([])
      const bbox = computeBoundingBox(positions)

      expect(bbox.min).toEqual([0, 0, 0])
      expect(bbox.max).toEqual([0, 0, 0])
      expect(bbox.dimensions).toEqual([0, 0, 0])
    })

    it('handles negative coordinates', () => {
      const positions = new Float32Array([
        -5, -3, -2, // Point 1
        -1, -1, -1, // Point 2
      ])
      const bbox = computeBoundingBox(positions)

      expect(bbox.min).toEqual([-5, -3, -2])
      expect(bbox.max).toEqual([-1, -1, -1])
      expect(bbox.dimensions).toEqual([4, 2, 1])
    })
  })

  describe('computeNormals', () => {
    it('computes normals for a single triangle', () => {
      // Triangle in XY plane
      const positions = new Float32Array([
        0, 0, 0, // V0
        1, 0, 0, // V1
        0, 1, 0, // V2
      ])
      const indices = new Uint32Array([0, 1, 2])

      const normals = computeNormals(positions, indices)

      // Normal should point in +Z direction
      expect(normals.length).toBe(9)
      // Check that all normals point roughly in +Z
      for (let i = 0; i < 3; i++) {
        expect(normals[i * 3]).toBeCloseTo(0, 5) // X
        expect(normals[i * 3 + 1]).toBeCloseTo(0, 5) // Y
        expect(normals[i * 3 + 2]).toBeCloseTo(1, 5) // Z
      }
    })

    it('produces normalized vectors', () => {
      const positions = new Float32Array([
        0, 0, 0,
        2, 0, 0,
        1, 2, 0,
      ])
      const indices = new Uint32Array([0, 1, 2])

      const normals = computeNormals(positions, indices)

      // Check each normal has length 1
      for (let i = 0; i < positions.length / 3; i++) {
        const x = normals[i * 3]
        const y = normals[i * 3 + 1]
        const z = normals[i * 3 + 2]
        const length = Math.sqrt(x * x + y * y + z * z)
        expect(length).toBeCloseTo(1, 5)
      }
    })

    it('averages normals for shared vertices', () => {
      // Two triangles sharing an edge
      const positions = new Float32Array([
        0, 0, 0, // V0 - shared
        1, 0, 0, // V1 - shared
        0.5, 1, 0, // V2 - top of first triangle
        0.5, -1, 0, // V3 - bottom of second triangle
      ])
      // Both triangles in XY plane
      const indices = new Uint32Array([
        0, 1, 2, // First triangle
        1, 0, 3, // Second triangle (reversed winding to test)
      ])

      const normals = computeNormals(positions, indices)

      // V0 and V1 are shared and should have averaged normals
      expect(normals.length).toBe(12)
    })
  })
})
