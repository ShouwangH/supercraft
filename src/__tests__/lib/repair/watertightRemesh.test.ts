import { describe, it, expect } from 'vitest'
import { watertightRemesh } from '@/lib/repair/watertightRemesh'
import { buildEdgeMap, getBoundaryEdges } from '@/lib/analysis/edgeMap'
import type { MeshData } from '@/types/mesh'

/**
 * Creates a simple open box mesh (missing top face) for testing.
 * This creates a 5-sided box with boundary edges around the open top.
 */
function createOpenBoxMesh(): MeshData {
  // 8 vertices of a unit box centered at origin
  const positions = new Float32Array([
    // Bottom 4 vertices
    -1, -1, -1,  // 0
    1, -1, -1,   // 1
    1, -1, 1,    // 2
    -1, -1, 1,   // 3
    // Top 4 vertices
    -1, 1, -1,   // 4
    1, 1, -1,    // 5
    1, 1, 1,     // 6
    -1, 1, 1,    // 7
  ])

  // 5 faces (10 triangles) - missing the top face
  const indices = new Uint32Array([
    // Bottom face
    0, 2, 1,
    0, 3, 2,
    // Front face
    3, 6, 2,
    3, 7, 6,
    // Back face
    0, 1, 5,
    0, 5, 4,
    // Left face
    0, 4, 7,
    0, 7, 3,
    // Right face
    1, 2, 6,
    1, 6, 5,
    // Top face MISSING - creates hole
  ])

  return {
    id: 'test-open-box',
    name: 'Open Box',
    positions,
    indices,
    normals: new Float32Array(positions.length),
    vertexCount: 8,
    triangleCount: 10,
    boundingBox: {
      min: [-1, -1, -1],
      max: [1, 1, 1],
      dimensions: [2, 2, 2],
    },
  }
}

/**
 * Creates a closed (watertight) box mesh for testing.
 */
function createClosedBoxMesh(): MeshData {
  const positions = new Float32Array([
    -1, -1, -1,  // 0
    1, -1, -1,   // 1
    1, -1, 1,    // 2
    -1, -1, 1,   // 3
    -1, 1, -1,   // 4
    1, 1, -1,    // 5
    1, 1, 1,     // 6
    -1, 1, 1,    // 7
  ])

  // All 6 faces (12 triangles)
  const indices = new Uint32Array([
    // Bottom
    0, 2, 1,
    0, 3, 2,
    // Top
    4, 5, 6,
    4, 6, 7,
    // Front
    3, 6, 2,
    3, 7, 6,
    // Back
    0, 1, 5,
    0, 5, 4,
    // Left
    0, 4, 7,
    0, 7, 3,
    // Right
    1, 2, 6,
    1, 6, 5,
  ])

  return {
    id: 'test-closed-box',
    name: 'Closed Box',
    positions,
    indices,
    normals: new Float32Array(positions.length),
    vertexCount: 8,
    triangleCount: 12,
    boundingBox: {
      min: [-1, -1, -1],
      max: [1, 1, 1],
      dimensions: [2, 2, 2],
    },
  }
}

/**
 * Creates a mesh with two separate holes.
 */
function createTwoHoleMesh(): MeshData {
  // A simple shape with two triangular holes
  const positions = new Float32Array([
    // First hole triangle vertices
    0, 0, 0,   // 0
    1, 0, 0,   // 1
    0.5, 1, 0, // 2
    // Second hole triangle vertices (offset)
    2, 0, 0,   // 3
    3, 0, 0,   // 4
    2.5, 1, 0, // 5
    // Base vertices connecting the two
    0, 0, 1,   // 6
    3, 0, 1,   // 7
  ])

  // Create faces that leave two triangular holes
  const indices = new Uint32Array([
    // Side faces around first hole
    0, 6, 1,
    1, 6, 7,
    1, 7, 4,
    4, 7, 3,
    3, 7, 6,
    3, 6, 0,
    // Connect to second hole
    1, 4, 5,
    1, 5, 2,
  ])

  return {
    id: 'test-two-hole',
    name: 'Two Hole Mesh',
    positions,
    indices,
    normals: new Float32Array(positions.length),
    vertexCount: 8,
    triangleCount: indices.length / 3,
    boundingBox: {
      min: [0, 0, 0],
      max: [3, 1, 1],
      dimensions: [3, 1, 1],
    },
  }
}

describe('watertightRemesh', () => {
  describe('with closed mesh', () => {
    it('returns original mesh when already watertight', () => {
      const mesh = createClosedBoxMesh()
      const result = watertightRemesh(mesh)

      expect(result.result.success).toBe(true)
      expect(result.result.stats?.holesFilled).toBe(0)
      expect(result.result.stats?.trianglesAdded).toBe(0)
      expect(result.result.stats?.verticesAdded).toBe(0)
      expect(result.mesh).toBe(mesh) // Same object reference
    })

    it('reports zero boundary edges', () => {
      const mesh = createClosedBoxMesh()
      const result = watertightRemesh(mesh)

      expect(result.result.stats?.boundaryEdgesBefore).toBe(0)
      expect(result.result.stats?.boundaryEdgesAfter).toBe(0)
    })
  })

  describe('with open box mesh', () => {
    it('fills the hole', () => {
      const mesh = createOpenBoxMesh()

      // Verify mesh has boundary edges before
      const edgeMapBefore = buildEdgeMap(mesh.indices)
      const boundaryBefore = getBoundaryEdges(edgeMapBefore)
      expect(boundaryBefore.length).toBe(4) // 4 edges around the open top

      const result = watertightRemesh(mesh)

      expect(result.result.success).toBe(true)
      expect(result.result.stats?.holesFilled).toBe(1)
    })

    it('adds correct number of triangles', () => {
      const mesh = createOpenBoxMesh()
      const result = watertightRemesh(mesh)

      // Hole has 4 edges, so fan triangulation adds 4 triangles
      expect(result.result.stats?.trianglesAdded).toBe(4)
      expect(result.mesh.triangleCount).toBe(mesh.triangleCount + 4)
    })

    it('adds one centroid vertex per hole', () => {
      const mesh = createOpenBoxMesh()
      const result = watertightRemesh(mesh)

      expect(result.result.stats?.verticesAdded).toBe(1)
      expect(result.mesh.vertexCount).toBe(mesh.vertexCount + 1)
    })

    it('reduces boundary edges to zero', () => {
      const mesh = createOpenBoxMesh()
      const result = watertightRemesh(mesh)

      expect(result.result.stats?.boundaryEdgesBefore).toBe(4)
      expect(result.result.stats?.boundaryEdgesAfter).toBe(0)

      // Verify with edge map
      const edgeMapAfter = buildEdgeMap(result.mesh.indices)
      const boundaryAfter = getBoundaryEdges(edgeMapAfter)
      expect(boundaryAfter.length).toBe(0)
    })

    it('creates new mesh with updated name', () => {
      const mesh = createOpenBoxMesh()
      const result = watertightRemesh(mesh)

      expect(result.mesh.id).toBe('test-open-box-watertight')
      expect(result.mesh.name).toBe('Open Box (watertight)')
    })

    it('preserves bounding box', () => {
      const mesh = createOpenBoxMesh()
      const result = watertightRemesh(mesh)

      // Centroid should be within original bounds
      expect(result.mesh.boundingBox.min[0]).toBe(mesh.boundingBox.min[0])
      expect(result.mesh.boundingBox.min[1]).toBe(mesh.boundingBox.min[1])
      expect(result.mesh.boundingBox.min[2]).toBe(mesh.boundingBox.min[2])
      expect(result.mesh.boundingBox.max[0]).toBe(mesh.boundingBox.max[0])
      expect(result.mesh.boundingBox.max[1]).toBe(mesh.boundingBox.max[1])
      expect(result.mesh.boundingBox.max[2]).toBe(mesh.boundingBox.max[2])
    })
  })

  describe('with maxHoleSize option', () => {
    it('skips holes larger than maxHoleSize', () => {
      const mesh = createOpenBoxMesh()
      const result = watertightRemesh(mesh, { maxHoleSize: 3 })

      // Hole has 4 edges, should be skipped
      expect(result.result.success).toBe(false)
      expect(result.result.stats?.holesFilled).toBe(0)
      expect(result.result.stats?.holesSkipped).toBe(1)
      expect(result.mesh).toBe(mesh) // Returns original mesh
    })

    it('fills holes within maxHoleSize', () => {
      const mesh = createOpenBoxMesh()
      const result = watertightRemesh(mesh, { maxHoleSize: 4 })

      // Hole has exactly 4 edges, should be filled
      expect(result.result.success).toBe(true)
      expect(result.result.stats?.holesFilled).toBe(1)
    })
  })

  describe('mesh validity', () => {
    it('produces valid indices', () => {
      const mesh = createOpenBoxMesh()
      const result = watertightRemesh(mesh)

      const maxVertex = result.mesh.vertexCount
      for (let i = 0; i < result.mesh.indices.length; i++) {
        expect(result.mesh.indices[i]).toBeLessThan(maxVertex)
        expect(result.mesh.indices[i]).toBeGreaterThanOrEqual(0)
      }
    })

    it('produces valid positions array', () => {
      const mesh = createOpenBoxMesh()
      const result = watertightRemesh(mesh)

      expect(result.mesh.positions.length).toBe(result.mesh.vertexCount * 3)
      expect(result.mesh.positions.length % 3).toBe(0)
    })

    it('produces valid normals array', () => {
      const mesh = createOpenBoxMesh()
      const result = watertightRemesh(mesh)

      expect(result.mesh.normals.length).toBe(result.mesh.vertexCount * 3)
    })

    it('produces valid indices array', () => {
      const mesh = createOpenBoxMesh()
      const result = watertightRemesh(mesh)

      expect(result.mesh.indices.length).toBe(result.mesh.triangleCount * 3)
      expect(result.mesh.indices.length % 3).toBe(0)
    })
  })

  describe('result metadata', () => {
    it('sets newMeshId when holes are filled', () => {
      const mesh = createOpenBoxMesh()
      const result = watertightRemesh(mesh)

      expect(result.result.newMeshId).toBe('test-open-box-watertight')
    })

    it('does not set newMeshId when no changes made', () => {
      const mesh = createClosedBoxMesh()
      const result = watertightRemesh(mesh)

      expect(result.result.newMeshId).toBeUndefined()
    })
  })
})
